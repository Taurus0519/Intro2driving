import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAunth.jsx";
import { supabase } from "./supabase_Client";
import StudentPicker from "./StudentPicker";
import {
  PDC_CHECKLIST_ITEM_COUNT,
  PDC_CHECKLIST_ITEMS,
  PDC_CHECKLIST_SECTIONS,
} from "../js/pdcChecklistData";
import "../css/PdcChecklist.css";
import "../css/PdcChecklistPrint.css";

const PDC_CHECKLIST_ITEM_IDS = new Set(
  PDC_CHECKLIST_ITEMS.filter((item) => !item.optional).map((item) => item.id),
);

function getProgress(responses) {
  const answered = responses.filter(
    (response) =>
      PDC_CHECKLIST_ITEM_IDS.has(response.item_id) &&
      (response.result === "yes" || response.result === "no"),
  ).length;
  return { answered, complete: answered === PDC_CHECKLIST_ITEM_COUNT };
}

export default function PdcChecklist() {
  const { profile, user } = useAuth();
  const isStaff = profile?.role === "admin" || profile?.role === "superadmin";
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState(isStaff ? "" : user.id);
  const [responses, setResponses] = useState([]);
  const [draftResponses, setDraftResponses] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPdf, setSavingPdf] = useState(false);
  const [savingItems, setSavingItems] = useState(() => new Set());
  const savingItemsRef = useRef(new Set());

  useEffect(() => {
    if (!isStaff) return undefined;

    let active = true;
    async function loadStudents() {
      const { data, error: studentsError } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "student")
        .order("name");

      if (!active) return;
      if (studentsError)
        setError(`Students could not be loaded: ${studentsError.message}`);
      else setStudents(data || []);
    }

    void loadStudents();
    return () => {
      active = false;
    };
  }, [isStaff]);

  useEffect(() => {
    let active = true;

    async function loadResponses() {
      setLoading(true);
      setError("");
      setResponses([]);
      setDraftResponses({});

      if (!studentId) {
        setLoading(false);
        return;
      }

      const { data, error: responsesError } = await supabase
        .from("pdc_checklist_responses")
        .select("item_id, result, remarks, updated_at")
        .eq("student_id", studentId);

      if (!active) return;
      if (responsesError)
        setError(
          `Checklist results could not be loaded: ${responsesError.message}`,
        );
      else setResponses(data || []);
      setLoading(false);
    }

    void loadResponses();
    return () => {
      active = false;
    };
  }, [studentId]);

  const responseByItem = useMemo(
    () =>
      new Map([
        ...responses.map((response) => [response.item_id, response]),
        ...Object.entries(draftResponses).map(([itemId, response]) => [
          itemId,
          response,
        ]),
      ]),
    [responses, draftResponses],
  );
  const savedItemIds = useMemo(
    () => new Set(responses.map((response) => response.item_id)),
    [responses],
  );
  const progress = getProgress(responses);
  const selectedStudent = students.find((student) => student.id === studentId);
  const studentName = isStaff
    ? selectedStudent?.name || ""
    : profile?.name || "";

  useEffect(() => {
    if (!isStaff || !studentId) return undefined;

    const timers = Object.entries(draftResponses).map(([itemId, response]) =>
      window.setTimeout(() => {
        void saveResponse(itemId, response);
      }, 800),
    );

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [draftResponses, isStaff, studentId]);

  function updateResponse(itemId, field, value) {
    setDraftResponses((current) => {
      const existing = current[itemId] ||
        responseByItem.get(itemId) || {
          item_id: itemId,
          result: "",
          remarks: "",
        };
      return {
        ...current,
        [itemId]: { ...existing, [field]: value },
      };
    });
  }

  function printChecklist() {
    if (!isStaff) return;
    if (Object.keys(draftResponses).length) {
      setError("Save your pending checklist changes before printing.");
      return;
    }
    window.print();
  }

  async function saveChecklistPdf() {
    if (!isStaff || savingPdf || loading || !studentId) return;
    if (Object.keys(draftResponses).length || savingItemsRef.current.size) {
      setError("Save your pending checklist changes before downloading a PDF.");
      return;
    }
    setSavingPdf(true);
    setError("");
    try {
      const { createChecklistPdf } = await import("../js/pdcChecklistPdf.mjs");
      const { pdf, filename } = await createChecklistPdf({
        studentName,
        sections: PDC_CHECKLIST_SECTIONS,
        responses,
      });
      await pdf.save(filename, { returnPromise: true });
    } catch {
      setError("The PDF could not be downloaded. Please try again.");
    } finally {
      setSavingPdf(false);
    }
  }

  async function saveResponse(itemId, response = responseByItem.get(itemId)) {
    if (!studentId) return;
    if (!response) return;
    if (savingItemsRef.current.has(itemId)) return;

    savingItemsRef.current.add(itemId);
    setSavingItems((current) => new Set(current).add(itemId));
    setError("");
    const { data, error: saveError } = await supabase
      .from("pdc_checklist_responses")
      .upsert(
        {
          student_id: studentId,
          item_id: itemId,
          result: ["yes", "no"].includes(response.result)
            ? response.result
            : null,
          remarks: response.remarks || "",
          evaluated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "student_id,item_id" },
      )
      .select("item_id, result, remarks, updated_at")
      .single();

    if (!saveError) {
      setResponses((current) =>
        current.some((item) => item.item_id === itemId)
          ? current.map((item) => (item.item_id === itemId ? data : item))
          : [...current, data],
      );
      setDraftResponses((current) => {
        const latestDraft = current[itemId];
        if (
          latestDraft &&
          (latestDraft.result !== response.result ||
            latestDraft.remarks !== response.remarks)
        ) {
          return { ...current };
        }
        const next = { ...current };
        delete next[itemId];
        return next;
      });
    }
    savingItemsRef.current.delete(itemId);
    setSavingItems((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });

    if (saveError) {
      setError(`Checklist item could not be saved: ${saveError.message}`);
    }
  }

  return (
    <div className="pdc-checklist-page" data-print-allowed={isStaff}>
      <div className="pdc-toolbar">
        <div className="pdc-print-heading">
          <p className="pdc-school-name">RITEWAY DRIVING SCHOOL</p>
          <p>Accreditation Number: DS-2022-00014-13</p>
          <h2>LIGHT VEHICLE</h2>
          <h3>8 HOURS PRACTICAL/ACTUAL DRIVING COURSE</h3>
        </div>
      </div>

      <div className="pdc-student-fields">
        <div>
          <strong>LTO Client ID:</strong>
          <span />
        </div>
        <div>
          <strong>Name:</strong>
          <span>{studentName}</span>
        </div>
        <div>
          <strong>Address:</strong>
          <span />
        </div>
        <div>
          <strong>License Type:</strong>
          <span />
          <strong>SP#:</strong>
          <span />
        </div>
      </div>

      {isStaff && (
        <StudentPicker
          id="pdc-student-select"
          className="pdc-student-select"
          label="Select student"
          students={students}
          value={studentId}
          onChange={setStudentId}
        />
      )}

      <div className="pdc-progress" aria-live="polite">
        <strong>
          {progress.complete
            ? "Checklist completed"
            : `${progress.answered} of ${PDC_CHECKLIST_ITEM_COUNT} items evaluated`}
        </strong>
        <span>
          {progress.complete
            ? "All checklist items have a Yes or No result."
            : "A checklist is complete after every item has a Yes or No result."}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading checklist...</p>
      ) : studentId ? (
        <div className="pdc-table-wrap">
          <table className="pdc-table">
            <thead>
              <tr>
                <th>Training item</th>
                <th>Yes</th>
                <th>No</th>
                <th>Remarks</th>
                {isStaff && <th className="pdc-save-heading">Save</th>}
              </tr>
            </thead>
            <tbody>
              {PDC_CHECKLIST_SECTIONS.map((section) => (
                <FragmentSection
                  key={section.title}
                  section={section}
                  responseByItem={responseByItem}
                  savedItemIds={savedItemIds}
                  draftResponses={draftResponses}
                  isStaff={isStaff}
                  savingItems={savingItems}
                  onUpdate={updateResponse}
                  onSave={saveResponse}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="pdc-empty">Select a student to review their checklist.</p>
      )}

      <div className="pdc-signatures">
        <div>
          <span />
          <strong>STUDENT SIGNATURE OVER PRINTED NAME AND DATE</strong>
        </div>
        <div>
          <span />
          <strong>INSTRUCTOR SIGNATURE OVER PRINTED NAME AND DATE</strong>
        </div>
      </div>
      {isStaff && (
        <div className="pdc-print-footer">
          <button
            type="button"
            className="button"
            onClick={printChecklist}
            disabled={loading || !studentId || savingPdf}
          >
            Print
          </button>
          <button
            type="button"
            className="button primary"
            onClick={saveChecklistPdf}
            disabled={loading || !studentId || savingPdf}
          >
            {savingPdf ? "Saving PDF..." : "Save PDF"}
          </button>
        </div>
      )}
    </div>
  );
}

function FragmentSection({
  section,
  responseByItem,
  savedItemIds,
  draftResponses,
  isStaff,
  savingItems,
  onUpdate,
  onSave,
}) {
  return (
    <>
      <tr className="pdc-section-row">
        <th colSpan={isStaff ? 5 : 4}>{section.title}</th>
      </tr>
      {section.items.map((item) => {
        const response = responseByItem.get(item.id) || {
          result: "",
          remarks: "",
        };
        const isSaving = savingItems.has(item.id);
        const hasDraft = Boolean(draftResponses[item.id]);

        return (
          <tr key={item.id}>
            <td>
              {item.label}
              {item.optional && (
                <span className="pdc-optional-label"> (Optional)</span>
              )}
            </td>
            {item.optional ? (
              <>
                <td className="pdc-choice-cell" aria-label="Not required" />
                <td className="pdc-choice-cell" aria-label="Not required" />
              </>
            ) : (
              ["yes", "no"].map((result) => (
                <td key={result} className="pdc-choice-cell">
                  {isStaff ? (
                    <button
                      type="button"
                      className={`pdc-choice-toggle${response.result === result ? " is-selected" : ""}`}
                      aria-label={`${result === "yes" ? "Yes" : "No"}: ${item.label}`}
                      aria-pressed={response.result === result}
                      onClick={() =>
                        onUpdate(
                          item.id,
                          "result",
                          response.result === result ? "" : result,
                        )
                      }
                      disabled={isSaving}
                    >
                      {response.result === result ? "✓" : ""}
                    </button>
                  ) : (
                    <span className="pdc-result-check" aria-hidden="true">
                      {response.result === result ? "✓" : ""}
                    </span>
                  )}
                </td>
              ))
            )}
            <td>
              {isStaff ? (
                <textarea
                  aria-label={`Remarks: ${item.label}`}
                  value={response.remarks || ""}
                  maxLength={1000}
                  onChange={(event) =>
                    onUpdate(item.id, "remarks", event.target.value)
                  }
                  rows={2}
                  disabled={isSaving}
                />
              ) : (
                response.remarks || ""
              )}
            </td>
            {isStaff && (
              <td className="pdc-save-cell">
                <span className="pdc-autosave-status" aria-live="polite">
                  {isSaving
                    ? "Saving..."
                    : hasDraft
                      ? "Autosaving..."
                      : savedItemIds.has(item.id)
                        ? "Saved"
                        : "Not saved"}
                </span>
                {hasDraft && (
                  <button
                    type="button"
                    className="button small-button"
                    disabled={isSaving}
                    onClick={() => onSave(item.id)}
                  >
                    Save now
                  </button>
                )}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}

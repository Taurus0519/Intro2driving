import { useEffect, useState } from "react";
import { supabase } from "./supabase_Client";
import { createAccount } from "./accounts";
import { useAuth } from "./useAunth.jsx";
import { Link } from "react-router-dom";
import Pagination from "./Pagination";
import "../css/StudentDetails.css";

const STUDENTS_PAGE_SIZE = 5;

export default function Students() {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    age: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setStudentsLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase
        .from("profiles")
        .select("id, name, status")
        .eq("role", "student")
        .order("name");
      if (loadError) throw loadError;
      setStudents(data || []);
      setPage(1);
    } catch (loadError) {
      setError(
        `Students could not be loaded: ${loadError.message || "Please try again."}`,
      );
    } finally {
      setStudentsLoading(false);
    }
  }

  const pageCount = Math.max(
    1,
    Math.ceil(students.length / STUDENTS_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const visibleStudents = students.slice(
    (currentPage - 1) * STUDENTS_PAGE_SIZE,
    currentPage * STUDENTS_PAGE_SIZE,
  );

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createAccount({ ...form, age: Number(form.age), role: "student" });
      setForm({ name: "", email: "", username: "", password: "", age: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function toggleStatus(s) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ status: s.status === "Active" ? "Inactive" : "Active" })
      .eq("id", s.id);
    if (updateError) {
      setError(`Student status could not be updated: ${updateError.message}`);
      return;
    }
    await load();
  }

  async function remove(s) {
    if (!window.confirm(`Delete ${s.name}?`)) return;
    setError("");
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token)
        throw new Error("Your session has expired. Sign in again.");

      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: ["Bearer", session.access_token].join(" "),
        },
        body: JSON.stringify({ userId: s.id }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          result?.error || "Student account could not be deleted.",
        );
      await load();
    } catch (deleteError) {
      setError(
        deleteError.message ||
          "Student account could not be deleted. Please try again.",
      );
    }
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h3>Students</h3>
          <p>Manage student accounts.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="button primary small-button"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "+ Add student"}
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {showForm && (
        <form className="panel" onSubmit={submit} style={{ marginBottom: 20 }}>
          <label>
            Full name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            Username
            <input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </label>
          <label>
            Age
            <input
              type="number"
              min="0"
              step="1"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              minLength={6}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </label>
          <button type="submit" className="button primary" disabled={loading}>
            {loading ? "Creating..." : "Create student"}
          </button>
        </form>
      )}

      <div className="panel table-wrap">
        <table className="data-table students-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {studentsLoading ? (
              <tr>
                <td colSpan="3">Loading students...</td>
              </tr>
            ) : (
              visibleStudents.map((s) => {
                const status = s.status || "Unknown";
                return (
                  <tr key={s.id}>
                    <td>
                      <Link
                        className="student-name-link"
                        to={`/students/${s.id}`}
                      >
                        {s.name || "Student"}
                      </Link>
                    </td>
                    <td>
                      <span className={`status ${status.toLowerCase()}`}>
                        {status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button small-button"
                        onClick={() => toggleStatus(s)}
                      >
                        {status === "Active" ? "Disable" : "Enable"}
                      </button>{" "}
                      <button
                        type="button"
                        className="button small-button danger"
                        onClick={() => remove(s)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {!studentsLoading && (
          <Pagination
            page={currentPage}
            pageSize={STUDENTS_PAGE_SIZE}
            totalItems={students.length}
            onPageChange={setPage}
          />
        )}
      </div>
    </>
  );
}

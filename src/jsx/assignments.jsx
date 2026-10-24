import { useEffect, useState } from "react";
import { supabase } from "./supabase_Client";
import { useAuth } from "./useAunth";
import StudentPicker from "./StudentPicker";

export default function Assignments() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: "",
    student_id: "",
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("assignments")
      .select("*, profiles!assignments_student_id_fkey(name)")
      .order("created_at", { ascending: false });
    setItems(data || []);
    if (profile.role === "admin") {
      const { data: s } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "student");
      setStudents(s || []);
    }
  }

  async function create(e) {
    e.preventDefault();
    await supabase.from("assignments").insert({ ...form, created_by: user.id });
    setForm({ title: "", description: "", due_date: "", student_id: "" });
    setShowForm(false);
    load();
  }

  async function toggleComplete(a) {
    await supabase
      .from("assignments")
      .update({ completed: !a.completed })
      .eq("id", a.id);
    load();
  }

  return (
    <>
      <div className="toolbar">
        <div>
          <h3>Assignments</h3>
          <p>Student work and due dates.</p>
        </div>
        {profile.role === "admin" && (
          <button
            className="button primary small-button"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? "Cancel" : "+ Assign"}
          </button>
        )}
      </div>

      {showForm && (
        <form className="panel" onSubmit={create} style={{ marginBottom: 20 }}>
          <StudentPicker
            id="assignment-student-select"
            label="Student"
            students={students}
            value={form.student_id}
            onChange={(studentId) =>
              setForm({ ...form, student_id: studentId })
            }
            placeholder="Select student"
          />
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label>
            Due date
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </label>
          <button className="button primary">Create</button>
        </form>
      )}

      <div className="panel table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Student</th>
              <th>Due</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{a.profiles?.name || "—"}</td>
                <td>{a.due_date || "—"}</td>
                <td>
                  <span className={`status ${a.completed ? "" : "pending"}`}>
                    {a.completed ? "Completed" : "Open"}
                  </span>
                </td>
                <td>
                  {(profile.role === "student" || profile.role === "admin") && (
                    <button
                      className="button small-button"
                      onClick={() => toggleComplete(a)}
                    >
                      {a.completed ? "Reopen" : "Mark done"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Quiz Panel (shown inline under a module row) ─────────────────────────────
function QuizPanel({ moduleId, onClose }: { moduleId: string; onClose: () => void }) {
  interface QuizQuestionRow {
    id:                 string;
    moduleId:           string;
    question:           string;
    options:            string[];
    correctAnswerIndex: number;
    orderIndex:         number;
    isActive:           boolean;
  }

  interface QuizQuestionForm {
    question:           string;
    option0:            string;
    option1:            string;
    option2:            string;
    option3:            string;
    correctAnswerIndex: string;
    orderIndex:         string;
    isActive:           boolean;
  }

  const emptyQForm = (): QuizQuestionForm => ({
    question: "", option0: "", option1: "", option2: "", option3: "",
    correctAnswerIndex: "0", orderIndex: "0", isActive: true,
  });

  const [questions,  setQuestions]  = useState<QuizQuestionRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState<QuizQuestionRow | null>(null);
  const [form,       setForm]       = useState<QuizQuestionForm>(emptyQForm());
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [formErr,    setFormErr]    = useState("");

  const loadQuestions = async () => {
    try {
      const data = await apiFetch<{ questions: QuizQuestionRow[] }>(
        `/admin/modules/${moduleId}/quiz-questions`
      );
      setQuestions(data.questions);
    } catch {
      setQuestions([]);
    }
  };

  useEffect(() => {
    loadQuestions().finally(() => setLoading(false));
  }, [moduleId]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyQForm());
    setFormErr("");
    setShowForm(true);
  };

  const openEdit = (q: QuizQuestionRow) => {
    setEditTarget(q);
    setForm({
      question:           q.question,
      option0:            q.options[0] ?? "",
      option1:            q.options[1] ?? "",
      option2:            q.options[2] ?? "",
      option3:            q.options[3] ?? "",
      correctAnswerIndex: q.correctAnswerIndex.toString(),
      orderIndex:         q.orderIndex.toString(),
      isActive:           q.isActive,
    });
    setFormErr("");
    setShowForm(true);
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim()) { setFormErr("Question text is required."); return; }
    if (!form.option0.trim() || !form.option1.trim()) {
      setFormErr("At least 2 options are required."); return;
    }
    setSaving(true);
    setFormErr("");
    try {
      const options = [form.option0, form.option1, form.option2, form.option3]
        .map((o) => o.trim())
        .filter(Boolean);
      const body = {
        question:           form.question.trim(),
        options,
        correctAnswerIndex: parseInt(form.correctAnswerIndex) || 0,
        orderIndex:         parseInt(form.orderIndex) || 0,
        isActive:           form.isActive,
      };
      if (editTarget) {
        await apiFetch(`/admin/quiz-questions/${editTarget.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/admin/modules/${moduleId}/quiz-questions`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await loadQuestions();
      setShowForm(false);
    } catch {
      setFormErr("Save failed. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this quiz question?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/admin/quiz-questions/${id}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="mt-2 ml-4 border-l-2 border-amber-500/30 pl-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
          Quiz Questions ({questions.length})
        </span>
        <div className="flex gap-2">
          <button
            onClick={openCreate}
            className="text-xs px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/20"
          >
            + Add Question
          </button>
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={saveQuestion}
          className="bg-muted/20 border border-border rounded-lg p-4 mb-4 space-y-3"
        >
          {formErr && <p className="text-xs text-destructive">{formErr}</p>}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Question *
            </label>
            <textarea
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              rows={2}
              placeholder="e.g. What should you do if a customer sends a complaint message?"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {([0, 1, 2, 3] as const).map((i) => (
              <div key={i}>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Option {optionLabels[i]} {i < 2 ? "*" : "(optional)"}
                </label>
                <input
                  type="text"
                  value={form[`option${i}` as keyof QuizQuestionForm] as string}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [`option${i}`]: e.target.value }))
                  }
                  placeholder={`Option ${optionLabels[i]}`}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  required={i < 2}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Correct Answer *
              </label>
              <select
                value={form.correctAnswerIndex}
                onChange={(e) =>
                  setForm((f) => ({ ...f, correctAnswerIndex: e.target.value }))
                }
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {optionLabels.map((label, i) => (
                  <option key={i} value={i}>
                    Option {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Order
              </label>
              <input
                type="number"
                min={0}
                value={form.orderIndex}
                onChange={(e) => setForm((f) => ({ ...f, orderIndex: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="q-active"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="q-active" className="text-sm text-foreground">
              Active (shown to clients)
            </label>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Question"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading questions…</p>
      ) : questions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No quiz questions yet.{" "}
          <button onClick={openCreate} className="text-primary underline">
            Add the first one.
          </button>
        </p>
      ) : (
        <table className="w-full text-xs mb-2">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              {["#", "Question", "Options", "Correct", "Active", ""].map((h) => (
                <th key={h} className="pb-1.5 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questions.map((q, i) => (
              <tr key={q.id} className="border-b border-border/40 hover:bg-muted/10">
                <td className="py-1.5 pr-3 text-muted-foreground">{i + 1}</td>
                <td className="py-1.5 pr-3 text-foreground max-w-xs truncate">
                  {q.question}
                </td>
                <td className="py-1.5 pr-3 text-muted-foreground">
                  {q.options.length} options
                </td>
                <td className="py-1.5 pr-3 text-amber-400 font-medium">
                  {optionLabels[q.correctAnswerIndex] ?? "?"}
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs ${
                      q.isActive
                        ? "bg-green-900/40 text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q.isActive ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="py-1.5 flex gap-2">
                  <button
                    onClick={() => openEdit(q)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    disabled={deleting === q.id}
                    className="text-destructive/70 hover:text-destructive disabled:opacity-50"
                  >
                    {deleting === q.id ? "…" : "Del"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
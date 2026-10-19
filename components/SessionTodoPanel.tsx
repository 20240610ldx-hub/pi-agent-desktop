"use client";

import { useI18n } from "@/hooks/useI18n";
import type { SessionTodoState } from "@/lib/session-todos";

/** Read-only view of the current branch's canonical extension snapshot. */
export function SessionTodoPanel({ todos }: { todos: SessionTodoState | null }) {
  const { t } = useI18n();
  if (!todos) return null;
  const tasks = todos.tasks.filter((task) => task.status !== "deleted");
  const completed = tasks.filter((task) => task.status === "completed").length;
  const inProgress = tasks.filter((task) => task.status === "in_progress").length;
  const pending = tasks.filter((task) => task.status === "pending").length;

  return (
    <section className="session-todo-panel" aria-label={t("sessionTodos.title")}>
      <details className="session-todo-disclosure" open>
        <summary className="session-todo-summary">
          <span className="session-todo-heading">{t("sessionTodos.title")}</span>
          {tasks.length > 0 && (
            <span className="session-todo-counts">
              <span>{t("sessionTodos.completedCount", { completed, total: tasks.length })}</span>
              {inProgress > 0 && <span>{t("sessionTodos.inProgressCount", { count: inProgress })}</span>}
              {pending > 0 && <span>{t("sessionTodos.pendingCount", { count: pending })}</span>}
            </span>
          )}
        </summary>
        {tasks.length === 0 ? <p className="session-todo-empty">{t("sessionTodos.empty")}</p> : (
          <ol className="session-todo-list">
            {tasks.map((task) => (
              <li key={task.id} className="session-todo-row" data-status={task.status}>
                <svg className="session-todo-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  {task.status === "completed" ? <path d="m4 10 4 4 8-8" /> : <><circle cx="10" cy="10" r="6" />{task.status === "in_progress" && <path d="M7 10h6" />}</>}
                </svg>
                <div className="session-todo-content">
                  <div className="session-todo-task-heading">
                    <span className="session-todo-id">#{task.id}</span>
                    <span className="session-todo-subject">{task.subject}</span>
                    <span className="session-todo-status">{t(`sessionTodos.status.${task.status}`)}</span>
                  </div>
                  {task.status === "in_progress" && task.activeForm && task.activeForm !== task.subject && <p className="session-todo-active-form">{task.activeForm}</p>}
                  {task.description && <p className="session-todo-description">{task.description}</p>}
                  {(task.owner || task.blockedBy?.length) ? (
                    <div className="session-todo-metadata">
                      {task.owner && <span>{t("sessionTodos.owner", { owner: task.owner })}</span>}
                      {Boolean(task.blockedBy?.length) && <span>{t("sessionTodos.dependsOn", { ids: task.blockedBy?.map((id) => `#${id}`).join(", ") ?? "" })}</span>}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}

import { useState } from 'react';
import type { Project, Task } from '../../shared/types';
import { isOpen, STATUS_LABEL } from '../../shared/types';
import { classifyTask } from '../../shared/queue';
import { formatDate } from '../../shared/dates';
import { newId } from '../../shared/task';
import { api } from '../api';
import { useSnap } from '../store';
import { EmptyState, Section, TaskRow } from '../components/ui';

export function ProjectsView() {
  const { snap, run } = useSnap();
  const [name, setName] = useState('');
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Grouped work with milestones. A project stays active while its next task waits on someone.</p>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void run(() => api().saveProject({ name: name.trim() }), 'Project created');
            setName('');
          }}
        >
          <input aria-label="New project name" placeholder="New project name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary" type="submit">Add project</button>
        </form>
      </header>
      {!snap.projects.length && <EmptyState title="No projects yet." />}
      {snap.projects.map((p) => <ProjectCard key={p.id} p={p} tasks={snap.tasks.filter((t) => t.projectId === p.id)} />)}
    </div>
  );
}

function ProjectCard({ p, tasks }: { p: Project; tasks: Task[] }) {
  const { snap, queueCtx, run } = useSnap();
  const [ms, setMs] = useState('');
  const [msDate, setMsDate] = useState('');
  const open = tasks.filter((t) => isOpen(t.status));
  const done = tasks.length - open.length;
  // The next task: first actionable one in queue order, else the earliest open one.
  const ranked = open.map((t) => ({ t, c: classifyTask(t, queueCtx) })).sort((a, b) => (b.c.entry?.score ?? -1) - (a.c.entry?.score ?? -1));
  const next = ranked[0];
  const save = (patch: Partial<Project>) => run(() => api().saveProject({ ...p, ...patch }));
  return (
    <Section
      title={p.name}
      id={`proj-${p.id}`}
      count={open.length}
      action={
        <span className="row">
          <select aria-label="Project status" value={p.status} onChange={(e) => save({ status: e.target.value as Project['status'] })}>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="done">Done</option>
          </select>
          <button className="link-btn" onClick={() => run(() => api().deleteProject(p.id), 'Project deleted (tasks kept)')}>Delete</button>
        </span>
      }
    >
      {p.description && <p className="muted">{p.description}</p>}
      <p className="hint">
        {done}/{tasks.length} tasks done.
        {next && (
          <>
            {' '}Next: <strong>{next.t.title}</strong> — {next.c.entry ? 'actionable now' : next.c.explanation}
            {next.t.status === 'waiting' && p.status === 'active' && ' (project remains active while waiting).'}
          </>
        )}
      </p>
      <div className="project-grid">
        <div>
          <h4>Milestones</h4>
          <ul className="checklist">
            {p.milestones.map((m) => (
              <li key={m.id}>
                <label>
                  <input type="checkbox" checked={m.done} onChange={() => save({ milestones: p.milestones.map((x) => (x.id === m.id ? { ...x, done: !x.done } : x)) })} />
                  <span className={m.done ? 'strike' : ''}>{m.title}</span>
                </label>
                <span className="hint">{m.dueDate ? formatDate(m.dueDate, snap.meta.today) : 'no date'}</span>
                <button className="link-btn" onClick={() => save({ milestones: p.milestones.filter((x) => x.id !== m.id) })}>Remove</button>
              </li>
            ))}
          </ul>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ms.trim()) return;
              void save({ milestones: [...p.milestones, { id: newId('m'), title: ms.trim(), dueDate: msDate || null, done: false }] });
              setMs('');
              setMsDate('');
            }}
          >
            <input aria-label="New milestone" placeholder="Milestone" value={ms} onChange={(e) => setMs(e.target.value)} />
            <input aria-label="Milestone date" type="date" value={msDate} onChange={(e) => setMsDate(e.target.value)} />
            <button className="btn" type="submit">Add</button>
          </form>
        </div>
        <div>
          <h4>Tasks</h4>
          {tasks.length ? (
            <ul className="task-list compact">
              {[...open, ...tasks.filter((t) => !isOpen(t.status))].map((t) => (
                <TaskRow key={t.id} task={t} extra={t.dependsOn.length ? `Depends on ${t.dependsOn.length} task(s)` : undefined} />
              ))}
            </ul>
          ) : (
            <p className="muted">Assign tasks to this project from the task details panel.</p>
          )}
          <button className="btn btn-small" onClick={() => run(() => api().createTask({ title: 'New task', projectId: p.id, status: 'ready' }), 'Task added')}>
            + Task in {STATUS_LABEL.ready}
          </button>
        </div>
      </div>
    </Section>
  );
}

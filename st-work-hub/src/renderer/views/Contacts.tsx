import { useState } from 'react';
import type { Contact } from '../../shared/types';
import { isOpen } from '../../shared/types';
import { api } from '../api';
import { useSnap } from '../store';
import { EmptyState } from '../components/ui';

export function ContactsView() {
  const { snap, run } = useSnap();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const related = (c: Contact) => snap.tasks.filter((t) => isOpen(t.status) && (t.contact.toLowerCase() === c.name.toLowerCase() || t.waitingOn.toLowerCase() === c.name.toLowerCase()));
  return (
    <div className="view">
      <header className="view-head">
        <div>
          <h1>Contacts</h1>
          <p className="sub">Mark a contact as closed to stop all outreach and follow-up suggestions for them.</p>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            void run(() => api().saveContact({ name: name.trim(), company: company.trim() }), 'Contact added');
            setName('');
            setCompany('');
          }}
        >
          <input aria-label="Contact name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input aria-label="Company" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          <button className="btn btn-primary" type="submit">Add</button>
        </form>
      </header>
      {!snap.contacts.length && <EmptyState title="No contacts yet." />}
      {snap.contacts.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Status</th><th scope="col">Open tasks</th><th scope="col">Notes</th><th scope="col" /></tr>
            </thead>
            <tbody>
              {snap.contacts.map((c) => (
                <tr key={c.id}>
                  <td className="strong">{c.name}{c.isDemo && <span className="chip chip-demo">Demo</span>}</td>
                  <td>{c.company}</td>
                  <td>
                    <select aria-label={`Status of ${c.name}`} value={c.status} onChange={(e) => run(() => api().saveContact({ ...c, status: e.target.value as Contact['status'] }))}>
                      <option value="active">Active</option>
                      <option value="closed">Closed — no outreach</option>
                    </select>
                  </td>
                  <td>{related(c).length}</td>
                  <td className="muted">{c.notes}</td>
                  <td><button className="link-btn" onClick={() => run(() => api().deleteContact(c.id))}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

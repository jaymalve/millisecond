import { useState, type FormEvent } from "react";
import type { Project } from "../lib/projects";

interface AddProjectModalProps {
  onAdd: (project: Project) => void;
  onClose: () => void;
}

export function AddProjectModal({ onAdd, onClose }: AddProjectModalProps) {
  const [name, setName] = useState("");
  const [workerName, setWorkerName] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !workerName.trim()) return;
    onAdd({ id: crypto.randomUUID(), name: name.trim(), workerName: workerName.trim() });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add project</h2>
        <p className="modal__note">
          Not wired up yet — this just adds an entry to the sidebar. Investigations still run against{" "}
          <code>target/</code> regardless of what's selected.
        </p>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-worker" autoFocus />
          </label>
          <label>
            Worker script name
            <input
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="my-worker-production"
            />
          </label>
          <div className="modal__actions">
            <button type="button" className="modal__cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || !workerName.trim()}>
              Add project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, type FormEvent } from "react";
import type { Project } from "../lib/projects";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Field, FieldLabel } from "./ui/field";
import { Input } from "./ui/input";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add project</DialogTitle>
          <DialogDescription>
            Not wired up yet — this just adds an entry to the sidebar. Investigations still run against{" "}
            <code className="inline-code">target/</code> regardless of what's selected.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="project-name">Name</FieldLabel>
            <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-worker" autoFocus />
          </Field>
          <Field>
            <FieldLabel htmlFor="project-worker-name">Worker script name</FieldLabel>
            <Input
              id="project-worker-name"
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="my-worker-production"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !workerName.trim()}>
              Add project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

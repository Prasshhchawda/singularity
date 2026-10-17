import { useRef, useState, type DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, FileText } from "lucide-react";
import { supabase } from "../services/supabase";
import { MAX_UPLOAD_BYTES } from "../services/received-files";

export const Route = createFileRoute("/send")({
  component: ClientUpload,
});

function ClientUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clientName, setClientName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  function selectFile(nextFile: File | undefined) {
    if (!nextFile) return;
    setError("");
    setSent(false);
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setError("Choose a file smaller than 50 MB.");
      return;
    }
    setFile(nextFile);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function sendFile() {
    console.log("SEND FILE FUNCTION RAN");
    if (!file) return;

    setError("");
    setSending(true);
    setSent(false);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Please log in before uploading.");
        return;
      }

      const contentType = file.type || "application/octet-stream";
      const storagePath = `${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("singularity-inbox")
        .upload(storagePath, file, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { error: databaseError } = await supabase.from("received_files").insert({
        filename: file.name,
        client_name: clientName.trim(),
        content_type: contentType,
        size_bytes: file.size,
        storage_path: storagePath,
      });

      if (databaseError) {
        await supabase.storage.from("singularity-inbox").remove([storagePath]);

        setError(databaseError.message);
        return;
      }

      setSent(true);
      setFile(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="client-send-page">
      <div className="client-send-brand">Singularity</div>
      <section className="client-send-content">
        <p className="client-send-eyebrow">PRIVATE FILE DELIVERY</p>
        <h1>Send to Singularity</h1>
        <p className="client-send-subtitle">A secure place for the files we need.</p>
        {!sent ? (
          <>
            <label className="client-name-field">
              <span>Your name</span>
              <input
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                autoComplete="name"
                placeholder="Name"
                maxLength={120}
              />
            </label>
            <label
              className={`client-dropzone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              htmlFor="client-file-input"
            >
              <input
                ref={inputRef}
                id="client-file-input"
                type="file"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
              <span className="dropzone-orbit" aria-hidden="true">
                <span />
              </span>
              {file ? (
                <span className="dropzone-selected-file">
                  <FileText size={19} strokeWidth={1.5} />
                  <span>
                    {file.name}
                    <small>{formatBytes(file.size)}</small>
                  </span>
                </span>
              ) : (
                <span className="dropzone-prompt">
                  <strong>Drop your file here</strong>
                  <small>or choose a file from your device</small>
                </span>
              )}
            </label>
            {error && (
              <p className="client-send-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="client-send-button"
              type="button"
              onClick={() => void sendFile()}
              disabled={!file || !clientName.trim() || sending}
            >
              {sending ? "Sending…" : "Send file"}
            </button>
            <p className="client-send-footnote">Files up to 50 MB</p>
          </>
        ) : (
          <div className="client-send-success" role="status">
            <span className="success-mark">
              <Check size={20} strokeWidth={1.7} />
            </span>
            <strong>Sent to Singularity ✓</strong>
            <span>Your file is on its way.</span>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setError("");
              }}
            >
              Send another file
            </button>
          </div>
        )}
      </section>
      <div className="client-send-footer">
        SINGULARITY <span>·</span> PRIVATE DELIVERY
      </div>
    </main>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

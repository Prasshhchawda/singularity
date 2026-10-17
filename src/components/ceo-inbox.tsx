import { useEffect, useState } from "react";
import {
  Archive,
  Download,
  ExternalLink,
  File,
  FileText,
  Image,
  LockKeyhole,
  MoreHorizontal,
  Trash2,
  UserRoundCog,
  X,
} from "lucide-react";
import {
  createReceivedFileUrl,
  deleteReceivedFile,
  fetchReceivedFiles,
  updateReceivedFile,
  type ReceivedFile,
} from "../services/received-files";

type InboxFilter = "all" | "new" | "archived";

const AGENT_OPTIONS = [
  "Operation and Business Strategist / Product Manager",
  "Category Manager",
  "Marketing Manager",
  "Business Analyst",
  "Logistics Manager",
  "Inventory Manager",
  "Senior Operation Executive",
  "Customer Experience Refund and Return",
];

export function CEOInbox() {
  const [files, setFiles] = useState<ReceivedFile[]>([]);
  const [selected, setSelected] = useState<ReceivedFile | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchReceivedFiles()
      .then((items) => {
        if (active) setFiles(items);
      })
      .catch(() => {
        if (active) setLoadError("Inbox is unavailable right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unreadCount = files.filter((file) => !file.is_read && file.status === "received").length;
  const visibleFiles = files.filter((file) => {
    if (filter === "new") return !file.is_read;
    if (filter === "archived") return file.status === "archived";
    return true; // "all" really means all now
  });

  async function chooseFile(file: ReceivedFile) {
    setSelected(file);
    setOpenMenu(null);
    setActionError("");
    if (file.is_read) return;

    try {
      await updateReceivedFile(file.id, { is_read: true });
      setFiles((current) =>
        current.map((item) => (item.id === file.id ? { ...item, is_read: true } : item)),
      );
      setSelected((current) => (current?.id === file.id ? { ...current, is_read: true } : current));
    } catch {
      setActionError("Read status could not be updated.");
    }
  }

  async function updateFile(
    file: ReceivedFile,
    changes: Partial<Pick<ReceivedFile, "status" | "assigned_agent">>,
  ) {
    setActionError("");
    try {
      await updateReceivedFile(file.id, changes);
      const updated = { ...file, ...changes };
      setFiles((current) => current.map((item) => (item.id === file.id ? updated : item)));
      setSelected(updated.status === "archived" ? null : updated);
    } catch {
      setActionError("That change could not be saved.");
    }
  }

  async function removeFile(file: ReceivedFile) {
    if (!window.confirm(`Permanently delete ${file.filename}?`)) return;
    setActionError("");
    try {
      await deleteReceivedFile(file);
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setSelected(null);
      setOpenMenu(null);
    } catch {
      setActionError("This file could not be deleted.");
    }
  }

  return (
    <section className="ceo-inbox" aria-label="CEO Inbox">
      <div className="inbox-heading">
        <div>
          <p className="inbox-kicker">SINGULARITY / PRIVATE</p>
          <h1>CEO Inbox</h1>
          <p className="inbox-subtitle">Private workspace</p>
        </div>
        <div className="inbox-heading-meta">
          <span className="inbox-file-count">
            {files
              .filter((file) => file.status === "received")
              .length.toString()
              .padStart(2, "0")}{" "}
            files
          </span>
          <span className="secure-indicator">
            <LockKeyhole size={13} strokeWidth={1.6} /> Secure
          </span>
        </div>
      </div>

      <div className={`inbox-layout${selected ? " has-selection" : ""}`}>
        <div className="inbox-list-column">
          <div className="inbox-list-header">
            <div className="inbox-list-label">
              Received files <span>{unreadCount ? `· ${unreadCount} new` : ""}</span>
            </div>
            <div className="inbox-filters" aria-label="Filter files">
              {(["all", "new", "archived"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "selected" : ""}
                  onClick={() => setFilter(value)}
                >
                  {value === "all" ? "All" : value === "new" ? "New" : "Archived"}
                </button>
              ))}
            </div>
          </div>

          {actionError && (
            <p className="inbox-error" role="status">
              {actionError}
            </p>
          )}
          {loadError && (
            <p className="inbox-error" role="alert">
              {loadError}
            </p>
          )}
          {loading ? (
            <div className="inbox-empty">
              Opening your inbox<span className="inbox-loading-dot">.</span>
            </div>
          ) : !loadError && visibleFiles.length === 0 ? (
            <div className="inbox-empty">
              <span className="inbox-empty-mark">
                <FileText size={19} strokeWidth={1.4} />
              </span>
              <span>
                {filter === "archived"
                  ? "Nothing archived"
                  : filter === "new"
                    ? "You’re all caught up"
                    : "No files received yet"}
              </span>
              <span className="inbox-empty-note">New client files will appear here.</span>
            </div>
          ) : (
            <div className="inbox-file-list">
              {visibleFiles.map((file) => (
                <div
                  key={file.id}
                  className={`inbox-file-card${selected?.id === file.id ? " is-selected" : ""}`}
                >
                  <button
                    className="inbox-file-select"
                    type="button"
                    onClick={() => void chooseFile(file)}
                    aria-label={`Open ${file.filename}`}
                  >
                    <span className="file-glyph" aria-hidden="true">
                      {fileIcon(file.content_type)}
                    </span>
                    <span className="file-card-copy">
                      <span className="file-card-title-row">
                        <span className="file-card-name">{file.filename}</span>
                        {!file.is_read && file.status === "received" && (
                          <span className="new-indicator">New</span>
                        )}
                      </span>
                      <span className="file-card-client">{file.client_name}</span>
                    </span>
                    <span className="file-card-date">{formatReceivedAt(file.received_at)}</span>
                    <span className="file-card-status">
                      {file.status === "archived" ? "Archived" : "Received"}
                    </span>
                  </button>
                  <div className="file-menu-wrap">
                    <button
                      className="file-menu-trigger"
                      type="button"
                      aria-label={`More actions for ${file.filename}`}
                      aria-expanded={openMenu === file.id}
                      onClick={() => setOpenMenu(openMenu === file.id ? null : file.id)}
                    >
                      <MoreHorizontal size={18} strokeWidth={1.7} />
                    </button>
                    {openMenu === file.id && (
                      <div className="file-menu" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() =>
                            void updateFile(file, {
                              status: file.status === "archived" ? "received" : "archived",
                            })
                          }
                        >
                          <Archive size={14} /> {file.status === "archived" ? "Restore" : "Archive"}
                        </button>
                        <button type="button" role="menuitem" onClick={() => void removeFile(file)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <FileDetail
            file={selected}
            onClose={() => setSelected(null)}
            onUpdate={updateFile}
            onDelete={removeFile}
          />
        )}
      </div>
    </section>
  );
}

function FileDetail({
  file,
  onClose,
  onUpdate,
  onDelete,
}: {
  file: ReceivedFile;
  onClose: () => void;
  onUpdate: (
    file: ReceivedFile,
    changes: Partial<Pick<ReceivedFile, "status" | "assigned_agent">>,
  ) => Promise<void>;
  onDelete: (file: ReceivedFile) => Promise<void>;
}) {
  const [signedUrl, setSignedUrl] = useState("");
  const [previewError, setPreviewError] = useState(false);
  const isPreviewable =
    file.content_type.startsWith("image/") || file.content_type === "application/pdf";

  useEffect(() => {
    let active = true;
    setSignedUrl("");
    setPreviewError(false);
    createReceivedFileUrl(file.storage_path, file.filename)
      .then((url) => {
        if (active) setSignedUrl(url);
      })
      .catch(() => {
        if (active) setPreviewError(true);
      });
    return () => {
      active = false;
    };
  }, [file.storage_path, file.filename]);

  async function downloadFile() {
    try {
      const url = await createReceivedFileUrl(file.storage_path, file.filename, true);
      const link = document.createElement("a");
      link.href = url;
      link.rel = "noreferrer";
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      setPreviewError(true);
    }
  }

  return (
    <aside className="file-detail" aria-label="File details">
      <div className="file-detail-topline">
        <span>FILE DETAILS</span>
        <button type="button" className="detail-close" onClick={onClose} aria-label="Close details">
          <X size={16} />
        </button>
      </div>
      <div className="file-preview">
        {isPreviewable && signedUrl && file.content_type.startsWith("image/") ? (
          <img src={signedUrl} alt={`Preview of ${file.filename}`} />
        ) : isPreviewable && signedUrl && file.content_type === "application/pdf" ? (
          <iframe src={`${signedUrl}#toolbar=0&navpanes=0`} title={`Preview of ${file.filename}`} />
        ) : (
          <div className="file-preview-placeholder">
            <span>{fileIcon(file.content_type)}</span>
            <small>{extension(file.filename)}</small>
          </div>
        )}
        {isPreviewable && previewError && (
          <span className="preview-unavailable">Preview unavailable</span>
        )}
      </div>
      <div className="file-detail-title">
        <h2>{file.filename}</h2>
        <p>{file.client_name}</p>
      </div>
      <dl className="file-properties">
        <div>
          <dt>Received</dt>
          <dd>{formatReceivedAt(file.received_at, true)}</dd>
        </div>
        <div>
          <dt>File type</dt>
          <dd>{file.content_type || "Unknown"}</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{formatBytes(file.size_bytes)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className="detail-status">
              <span />
              {file.status === "archived" ? "Archived" : "Received"}
            </span>
          </dd>
        </div>
        <div>
          <dt>Assigned agent</dt>
          <dd>{file.assigned_agent || "Unassigned"}</dd>
        </div>
      </dl>
      <div className="detail-agent-field">
        <UserRoundCog size={15} strokeWidth={1.6} />
        <select
          aria-label="Assign to agent"
          value={file.assigned_agent ?? ""}
          onChange={(event) => void onUpdate(file, { assigned_agent: event.target.value || null })}
        >
          <option value="">Assign to Agent</option>
          {AGENT_OPTIONS.map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
      </div>
      <div className="file-detail-actions">
        <button
          type="button"
          className="detail-action primary"
          disabled={!signedUrl}
          onClick={() => signedUrl && window.open(signedUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={15} /> Open
        </button>
        <button type="button" className="detail-action" onClick={() => void downloadFile()}>
          <Download size={15} /> Download
        </button>
        <button
          type="button"
          className="detail-action"
          onClick={() =>
            void onUpdate(file, { status: file.status === "archived" ? "received" : "archived" })
          }
        >
          <Archive size={15} /> {file.status === "archived" ? "Restore" : "Archive"}
        </button>
        <button type="button" className="detail-action delete" onClick={() => void onDelete(file)}>
          <Trash2 size={15} /> Delete
        </button>
      </div>
    </aside>
  );
}

function fileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <Image size={19} strokeWidth={1.5} />;
  if (contentType.includes("pdf") || contentType.startsWith("text/"))
    return <FileText size={19} strokeWidth={1.5} />;
  return <File size={19} strokeWidth={1.5} />;
}

function extension(filename: string) {
  return filename.split(".").pop()?.slice(0, 6).toUpperCase() || "FILE";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

function formatReceivedAt(value: string, includeYear = false) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

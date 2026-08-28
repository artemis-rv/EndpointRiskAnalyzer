/**
 * pages/admin/AdminReleasesPage.tsx
 * ─────────────────────────────────
 * Create, edit, publish and delete releases.
 *
 * Two things worth noting:
 *
 *  1. `file_path` is a server-side filesystem path. It appears in this form
 *     because `POST /admin/releases` requires it, and it is shown nowhere
 *     outside the admin area — `ReleasePublicResponse` omits it entirely.
 *
 *  2. Deletion is irreversible, so it goes through a confirmation dialog that
 *     names the version being removed. No destructive action fires on a single
 *     click anywhere in this page.
 */

import { useState } from 'react';
import { PageMeta } from '@/components/seo/PageMeta';
import {
  useAdminReleases,
  useCreateRelease,
  useDeleteRelease,
  useUpdateRelease,
} from '@/hooks/useAdmin';
import { usePagination } from '@/hooks/usePagination';
import { ApiError } from '@/api/client/errors';
import { ReleaseStatus } from '@/types/api';
import type { AdminRelease } from '@/types/api';
import { RELEASE_STATUS_LABELS } from '@/constants/content';
import { AdminPageHeader } from '@/components/admin/AdminPrimitives';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PausedState, SkeletonTableRows } from '@/components/common/States';
import { isStalled } from '@/utils/queryState';
import { Badge, ReleaseStatusBadge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { Alert } from '@/components/common/Alert';
import { ConfirmDialog, Modal } from '@/components/common/Modal';
import {
  FormError,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/forms/Fields';
import { EditIcon, PackageIcon, PlusIcon, TrashIcon } from '@/components/common/Icons';
import { formatBytes, formatDate, isoDateAttr, shortChecksum } from '@/utils/format';
import {
  isClean,
  maxLength,
  required,
  validateChecksum,
  validateFileSize,
  validateVersion,
} from '@/utils/validation';
import type { FieldErrors } from '@/utils/validation';

interface ReleaseFormValues {
  version: string;
  title: string;
  description: string;
  release_notes: string;
  file_path: string;
  file_size: string;
  sha256_checksum: string;
  release_status: string;
}

const EMPTY_FORM: ReleaseFormValues = {
  version: '',
  title: '',
  description: '',
  release_notes: '',
  file_path: '',
  file_size: '',
  sha256_checksum: '',
  release_status: ReleaseStatus.DRAFT,
};

const STATUS_OPTIONS = Object.values(ReleaseStatus).map((value) => ({
  value,
  label: RELEASE_STATUS_LABELS[value],
}));

export function AdminReleasesPage() {
  const { page, pageSize, setPage } = usePagination(20);
  const { data, isLoading, isError, error, isFetching, fetchStatus, refetch } = useAdminReleases(
    page,
    pageSize,
  );

  const createRelease = useCreateRelease();
  const updateRelease = useUpdateRelease();
  const deleteRelease = useDeleteRelease();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRelease | null>(null);
  const [values, setValues] = useState<ReleaseFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors<ReleaseFormValues>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [pendingDelete, setPendingDelete] = useState<AdminRelease | null>(null);
  const [banner, setBanner] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const releases = data?.data ?? [];
  const saving = createRelease.isPending || updateRelease.isPending;

  function openCreate() {
    setEditing(null);
    setValues(EMPTY_FORM);
    setErrors({});
    setFormError(null);
    setEditorOpen(true);
  }

  function openEdit(release: AdminRelease) {
    setEditing(release);
    setValues({
      version: release.version,
      title: release.title,
      description: release.description ?? '',
      release_notes: release.release_notes,
      file_path: release.file_path,
      file_size: String(release.file_size),
      sha256_checksum: release.sha256_checksum,
      release_status: release.release_status,
    });
    setErrors({});
    setFormError(null);
    setEditorOpen(true);
  }

  function update<K extends keyof ReleaseFormValues>(key: K, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): FieldErrors<ReleaseFormValues> {
    return {
      // Version is immutable once created: PATCH does not accept it.
      version: editing ? undefined : validateVersion(values.version),
      title: required(values.title, 'Title') ?? maxLength(values.title.trim(), 255, 'Title'),
      description: maxLength(values.description.trim(), 2048, 'Description'),
      release_notes:
        required(values.release_notes, 'Release notes') ??
        maxLength(values.release_notes.trim(), 65536, 'Release notes'),
      file_path:
        required(values.file_path, 'File path') ??
        maxLength(values.file_path.trim(), 1024, 'File path'),
      file_size: validateFileSize(values.file_size),
      sha256_checksum: validateChecksum(values.sha256_checksum),
      release_status: required(values.release_status, 'Status'),
    };
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validate();
    setErrors(nextErrors);
    if (!isClean(nextErrors)) return;

    const shared = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      release_notes: values.release_notes.trim(),
      file_path: values.file_path.trim(),
      file_size: Number(values.file_size),
      sha256_checksum: values.sha256_checksum.trim().toLowerCase(),
      release_status: values.release_status as ReleaseStatus,
    };

    try {
      if (editing) {
        await updateRelease.mutateAsync({ id: editing.release_id, payload: shared });
        setBanner({ tone: 'success', text: `Release v${editing.version} updated.` });
      } else {
        await createRelease.mutateAsync({ version: values.version.trim(), ...shared });
        setBanner({ tone: 'success', text: `Release v${values.version.trim()} created.` });
      }
      setEditorOpen(false);
      setEditing(null);
      setValues(EMPTY_FORM);
    } catch (caught) {
      if (caught instanceof ApiError) {
        const fieldErrors = caught.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors as FieldErrors<ReleaseFormValues>);
          setFormError('Please correct the highlighted fields.');
        } else {
          setFormError(caught.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const version = pendingDelete.version;
    try {
      await deleteRelease.mutateAsync(pendingDelete.release_id);
      setBanner({ tone: 'success', text: `Release v${version} deleted.` });
    } catch (caught) {
      setBanner({
        tone: 'danger',
        text: caught instanceof ApiError ? caught.message : 'The release could not be deleted.',
      });
    } finally {
      setPendingDelete(null);
    }
  }

  /** One-click publish for a draft, still confirmed because it is public-facing. */
  const [pendingPublish, setPendingPublish] = useState<AdminRelease | null>(null);

  async function handlePublish() {
    if (!pendingPublish) return;
    const target = pendingPublish;
    try {
      await updateRelease.mutateAsync({
        id: target.release_id,
        payload: {
          release_status: ReleaseStatus.PUBLISHED,
          published_at: new Date().toISOString(),
        },
      });
      setBanner({ tone: 'success', text: `Release v${target.version} is now published.` });
    } catch (caught) {
      setBanner({
        tone: 'danger',
        text: caught instanceof ApiError ? caught.message : 'The release could not be published.',
      });
    } finally {
      setPendingPublish(null);
    }
  }

  return (
    <>
      <PageMeta title="Manage releases" noIndex />

      <AdminPageHeader
        title="Releases"
        description="Every release, in every status. Published releases are visible to the public."
        actions={
          <Button variant="admin" onClick={openCreate} leadingIcon={<PlusIcon className="h-4 w-4" />}>
            New release
          </Button>
        }
      />

      {banner ? (
        <Alert tone={banner.tone} className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <p>{banner.text}</p>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="shrink-0 text-xs font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        </Alert>
      ) : null}

      <div className="card" role="region" aria-label="Releases">
        {isError ? (
          <ErrorState
            error={error}
            title="Unable to load releases"
            onRetry={() => void refetch()}
          />
        ) : isStalled(fetchStatus, data !== undefined) ? (
          <PausedState onRetry={() => void refetch()} />
        ) : data !== undefined && releases.length === 0 ? (
          <EmptyState
            icon={<PackageIcon className="h-6 w-6" />}
            title="No releases yet"
            description="Create the first release to make a build available for download."
            action={
              <Button variant="admin" size="sm" onClick={openCreate}>
                Create a release
              </Button>
            }
          />
        ) : (
          <>
            <div className="table-wrap !border-0">
              <table className="table">
                <caption className="sr-only">
                  All releases with version, status, size, checksum and publication date.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Release</th>
                    <th scope="col">Status</th>
                    <th scope="col">Size</th>
                    <th scope="col">Checksum</th>
                    <th scope="col">Published</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <SkeletonTableRows rows={5} columns={6} />
                  ) : (
                    releases.map((release) => (
                      <tr key={release.release_id}>
                        <td>
                          <span className="block font-medium text-ink-900">{release.title}</span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className="font-mono text-xs text-ink-500">
                              v{release.version}
                            </span>
                            {release.is_latest ? <Badge tone="success">Latest</Badge> : null}
                          </span>
                        </td>
                        <td>
                          <ReleaseStatusBadge status={release.release_status} />
                        </td>
                        <td className="whitespace-nowrap tabular-nums">
                          {formatBytes(release.file_size)}
                        </td>
                        <td>
                          <span
                            className="font-mono text-xs text-ink-500"
                            title={release.sha256_checksum}
                          >
                            {shortChecksum(release.sha256_checksum)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          <time dateTime={isoDateAttr(release.published_at)}>
                            {formatDate(release.published_at)}
                          </time>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1.5">
                            {release.release_status === ReleaseStatus.DRAFT ? (
                              <Button
                                size="sm"
                                variant="admin"
                                onClick={() => setPendingPublish(release)}
                              >
                                Publish
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEdit(release)}
                              leadingIcon={<EditIcon className="h-3.5 w-3.5" />}
                              aria-label={`Edit release v${release.version}`}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setPendingDelete(release)}
                              aria-label={`Delete release v${release.version}`}
                              className="!text-danger-700"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {data ? (
              <Pagination
                page={data.page}
                pageSize={data.page_size}
                total={data.total}
                hasNext={data.has_next}
                hasPrev={data.has_prev}
                onPageChange={setPage}
                busy={isFetching}
                itemLabel="releases"
              />
            ) : null}
          </>
        )}
      </div>

      {/* Create / edit */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        busy={saving}
        size="lg"
        title={editing ? `Edit v${editing.version}` : 'New release'}
        description={
          editing
            ? 'The version number cannot be changed after a release is created.'
            : 'A release starts as a draft. Publish it when it is ready to be downloaded.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="admin"
              type="submit"
              form="release-form"
              loading={saving}
              loadingLabel="Saving"
            >
              {editing ? 'Save changes' : 'Create release'}
            </Button>
          </>
        }
      >
        <form id="release-form" onSubmit={handleSave} noValidate className="space-y-5">
          <FormError message={formError} />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Version"
              required
              value={values.version}
              onChange={(event) => update('version', event.target.value)}
              error={errors.version}
              hint="Semantic version, for example 1.4.0."
              placeholder="1.0.0"
              disabled={saving || editing !== null}
              maxLength={50}
            />
            <SelectField
              label="Status"
              required
              options={STATUS_OPTIONS}
              value={values.release_status}
              onChange={(event) => update('release_status', event.target.value)}
              error={errors.release_status}
              disabled={saving}
            />
          </div>

          <TextField
            label="Title"
            required
            value={values.title}
            onChange={(event) => update('title', event.target.value)}
            error={errors.title}
            maxLength={255}
            disabled={saving}
          />

          <TextAreaField
            label="Short description"
            value={values.description}
            onChange={(event) => update('description', event.target.value)}
            error={errors.description}
            maxChars={2048}
            rows={3}
            hint="One or two sentences shown above the release notes."
            disabled={saving}
          />

          <TextAreaField
            label="Release notes"
            required
            value={values.release_notes}
            onChange={(event) => update('release_notes', event.target.value)}
            error={errors.release_notes}
            maxChars={65536}
            rows={8}
            hint="Plain text. Line breaks are preserved when this is displayed."
            disabled={saving}
          />

          <TextField
            label="Artefact filename"
            required
            value={values.file_path}
            onChange={(event) => update('file_path', event.target.value)}
            error={errors.file_path}
            maxLength={1024}
            hint="Filename relative to the server storage root. Never shown on the public site, and never used to reach outside that root."
            placeholder="riskintel-1.0.0.tar.gz"
            disabled={saving}
            className="font-mono text-xs"
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="File size in bytes"
              required
              inputMode="numeric"
              value={values.file_size}
              onChange={(event) => update('file_size', event.target.value.replace(/[^\d]/g, ''))}
              error={errors.file_size}
              hint={
                values.file_size && Number(values.file_size) > 0
                  ? formatBytes(Number(values.file_size))
                  : 'Whole number of bytes.'
              }
              disabled={saving}
            />
            <TextField
              label="SHA-256 checksum"
              required
              value={values.sha256_checksum}
              onChange={(event) => update('sha256_checksum', event.target.value.trim())}
              error={errors.sha256_checksum}
              maxLength={64}
              hint="64 hexadecimal characters."
              disabled={saving}
              className="font-mono text-xs"
            />
          </div>
        </form>
      </Modal>

      {/* Publish confirmation */}
      <ConfirmDialog
        open={pendingPublish !== null}
        onCancel={() => setPendingPublish(null)}
        onConfirm={handlePublish}
        busy={updateRelease.isPending}
        title="Publish this release?"
        message={
          pendingPublish
            ? `Version ${pendingPublish.version} will become visible on the public download page and available to every verified account. You can archive it later, but it will have been public in the meantime.`
            : ''
        }
        confirmLabel="Publish"
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        busy={deleteRelease.isPending}
        destructive
        title="Delete this release?"
        message={
          pendingDelete
            ? `Version ${pendingDelete.version} will be removed permanently. This cannot be undone. If you only want to take it off the public site, archive it instead.`
            : ''
        }
        confirmLabel="Delete permanently"
      />
    </>
  );
}

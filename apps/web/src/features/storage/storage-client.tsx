'use client';

import { useState, useCallback, useMemo } from 'react';
import { UploadButton } from '@uploadthing/react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Check,
  MoreVertical,
  File,
  Lock,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  StorageBucket,
  StorageObject,
  BucketAccess,
} from '@orion/types';
import { OurStorageRouter } from '../../../../api/src/storage/uploadthing';

interface StorageClientProps {
  orgSlug: string;
  projectSlug: string;
  initialBuckets: StorageBucket[];
  initialObjects?: StorageObject[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
}

async function assertResponseOk(res: Response, fallback: string) {
  if (res.ok) return;
  let message = fallback;
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (typeof body.message === 'string') message = body.message;
    else if (Array.isArray(body.message)) message = body.message.join(', ');
  } catch {
    // Keep the fallback when the response is not JSON.
  }
  throw new Error(message);
}

export function StorageClient({
  orgSlug,
  projectSlug,
  initialBuckets,
  initialObjects = [],
}: StorageClientProps) {
  const [buckets, setBuckets] = useState<StorageBucket[]>(initialBuckets);
  const [activeBucket, setActiveBucket] = useState<StorageBucket | null>(
    initialBuckets[0] ?? null,
  );
  const [objects, setObjects] = useState<StorageObject[]>(initialObjects);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [objectFilter, setObjectFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [newBucketAccess, setNewBucketAccess] =
    useState<BucketAccess>('public');
  const [creating, setCreating] = useState(false);

  const apiBase = getApiBaseUrl();
  const storageBase = `${apiBase}/orgs/${orgSlug}/projects/${projectSlug}/storage`;
  const apiOrigin = useMemo(() => new URL(apiBase).origin, [apiBase]);

  const uploadFetch = useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const isOurApi = new URL(href).origin === apiOrigin;
      return fetch(input, {
        ...init,
        credentials: isOurApi ? 'include' : init?.credentials,
      });
    },
    [apiOrigin],
  );

  const uploadUrl = useMemo(() => {
    if (!activeBucket) return '';
    return `${storageBase}/buckets/${activeBucket.id}/upload`;
  }, [storageBase, activeBucket]);

  const filteredObjects = useMemo(() => {
    const query = objectFilter.trim().toLowerCase();
    if (!query) return objects;
    return objects.filter((object) =>
      object.name.toLowerCase().includes(query),
    );
  }, [objects, objectFilter]);

  const loadObjects = useCallback(
    async (bucket: StorageBucket) => {
      setActiveBucket(bucket);
      setLoadingObjects(true);
      setError(null);
      setObjectFilter('');
      try {
        const res = await fetch(`${storageBase}/buckets/${bucket.id}/objects`, {
          credentials: 'include',
        });
        await assertResponseOk(res, 'Could not load bucket files.');
        const data = (await res.json()) as StorageObject[];
        setObjects(data);
      } catch (cause) {
        setObjects([]);
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not load bucket files.',
        );
      } finally {
        setLoadingObjects(false);
      }
    },
    [storageBase],
  );

  const createBucket = async () => {
    if (!newBucketName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${storageBase}/buckets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newBucketName, access: newBucketAccess }),
      });
      await assertResponseOk(res, 'Could not create bucket.');
      const bucket = (await res.json()) as StorageBucket;
      setBuckets((prev) => [...prev, bucket]);
      setCreateOpen(false);
      setNewBucketName('');
      await loadObjects(bucket);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not create bucket.',
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteBucket = async (bucketId: string) => {
    if (!window.confirm('Delete this bucket and all of its files?')) return;
    setError(null);
    try {
      const res = await fetch(`${storageBase}/buckets/${bucketId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await assertResponseOk(res, 'Could not delete bucket.');
      const remaining = buckets.filter((bucket) => bucket.id !== bucketId);
      setBuckets(remaining);
      if (activeBucket?.id === bucketId) {
        setActiveBucket(null);
        setObjects([]);
        if (remaining[0]) await loadObjects(remaining[0]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete bucket.',
      );
    }
  };

  const deleteObject = async (objectId: string) => {
    setError(null);
    try {
      const res = await fetch(`${storageBase}/objects/${objectId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await assertResponseOk(res, 'Could not delete file.');
      setObjects((prev) => prev.filter((o) => o.id !== objectId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete file.',
      );
    }
  };

  const copyUrl = async (object: StorageObject) => {
    setError(null);
    try {
      let url = object.url;

      if (!url) {
        const res = await fetch(
          `${storageBase}/objects/${object.id}/signed-url`,
          { credentials: 'include' },
        );
        await assertResponseOk(res, 'Could not create a file link.');
        const data = (await res.json()) as { url: string };
        url = data.url;
      }

      await navigator.clipboard.writeText(url);
      setCopiedId(object.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not copy file link.',
      );
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      {error && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive"
        >
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-full w-full min-h-0"
          defaultLayout={{ 'storage-buckets': 20, 'storage-files': 80 }}
        >
          <ResizablePanel
            id="storage-buckets"
            defaultSize="20"
            minSize="15"
            maxSize="30"
          >
            <div className="flex h-full w-full flex-col overflow-hidden border-r border-border bg-background">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-medium">Buckets</span>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 gap-1">
                      <Plus size={14} />
                      New bucket
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create bucket</DialogTitle>
                    </DialogHeader>
                    <div className="mt-2 space-y-4">
                      <div className="space-y-1">
                        <Label htmlFor="bucket-name">Name</Label>
                        <Input
                          id="bucket-name"
                          value={newBucketName}
                          onChange={(e) => setNewBucketName(e.target.value)}
                          placeholder="my-bucket"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Access</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={
                              newBucketAccess === 'public'
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setNewBucketAccess('public')}
                          >
                            <Globe size={12} />
                            Public
                          </Button>
                          <Button
                            type="button"
                            variant={
                              newBucketAccess === 'private'
                                ? 'default'
                                : 'outline'
                            }
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setNewBucketAccess('private')}
                          >
                            <Lock size={12} />
                            Private
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {newBucketAccess === 'public'
                            ? 'Files are accessible via their URL without authentication'
                            : 'Files require a signed URL to access'}
                        </p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setCreateOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => void createBucket()}
                          disabled={creating}
                        >
                          {creating ? 'Creating...' : 'Create'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {buckets.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No buckets yet
                  </p>
                ) : (
                  buckets.map((bucket) => (
                    <div
                      key={bucket.id}
                      className={cn(
                        'flex cursor-pointer items-center justify-between px-3 py-2',
                        activeBucket?.id === bucket.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50',
                      )}
                      onClick={() => void loadObjects(bucket)}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FolderOpen
                          size={14}
                          className="shrink-0 text-muted-foreground"
                        />
                        <span className="truncate text-sm">{bucket.name}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {bucket.access === 'private' ? (
                          <Lock size={10} className="text-muted-foreground" />
                        ) : (
                          <Globe size={10} className="text-muted-foreground" />
                        )}
                        {activeBucket?.id === bucket.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical size={10} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="text-destructive"
                                onSelect={() => void deleteBucket(bucket.id)}
                              >
                                <Trash2 size={12} className="mr-1.5" />
                                Delete bucket
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel
            id="storage-files"
            defaultSize="80"
            minSize="50"
          >
            <div className="flex h-full w-full min-h-0 flex-col overflow-hidden">
              {activeBucket && (
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {activeBucket.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="gap-1 text-xs capitalize"
                    >
                      {activeBucket.access === 'private' ? (
                        <>
                          <Lock size={10} /> Private
                        </>
                      ) : (
                        <>
                          <Globe size={10} /> Public
                        </>
                      )}
                    </Badge>
                  </div>

                  {uploadUrl && activeBucket ? (
                    <UploadButton<OurStorageRouter, 'bucketUploader'>
                      url={uploadUrl}
                      endpoint="bucketUploader"
                      fetch={uploadFetch}
                      onClientUploadComplete={async (files) => {
                        setError(null);
                        try {
                          for (const file of files) {
                            const res = await fetch(
                              `${storageBase}/buckets/${activeBucket.id}/objects`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  name: file.name,
                                  size: file.size,
                                  type: file.type ?? 'application/octet-stream',
                                  utKey: file.key,
                                  url: file.url,
                                }),
                              },
                            );
                            await assertResponseOk(
                              res,
                              'Upload completed, but the file could not be added to this bucket.',
                            );
                            const object = (await res.json()) as StorageObject;
                            setObjects((prev) => [object, ...prev]);
                          }
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : 'Could not add uploaded file to this bucket.',
                          );
                        }
                      }}
                      onUploadError={(error) => {
                        setError(`Upload failed: ${error.message}`);
                      }}
                      appearance={{
                        button:
                          'ut-ready:bg-primary ut-ready:text-primary-foreground h-8 px-3 text-sm rounded-md',
                        allowedContent: 'hidden',
                      }}
                    />
                  ) : null}
                </div>
              )}

              {activeBucket && objects.length > 0 && (
                <div className="shrink-0 border-b border-border px-4 py-2">
                  <Input
                    aria-label="Filter files"
                    value={objectFilter}
                    onChange={(event) => setObjectFilter(event.target.value)}
                    placeholder="Filter files by name..."
                    className="h-8 max-w-sm"
                  />
                </div>
              )}

              {!activeBucket ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <FolderOpen
                    size={32}
                    className="mb-3 text-muted-foreground"
                  />
                  <p className="text-sm text-muted-foreground">
                    Select a bucket to browse files
                  </p>
                </div>
              ) : loadingObjects ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : filteredObjects.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <p className="text-sm text-muted-foreground">
                    {objects.length === 0
                      ? 'This bucket is empty'
                      : 'No files match your filter'}
                  </p>
                  {objects.length === 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Upload files using the button above
                    </p>
                  )}
                </div>
              ) : (
                <div className="min-h-0 w-full flex-1 overflow-y-auto">
                  <div className="grid w-full grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filteredObjects.map((object) => (
                      <div
                        key={object.id}
                        className="group relative rounded-xl border border-border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="mb-2 flex h-16 items-center justify-center">
                          {object.mimeType.startsWith('image/') &&
                          object.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={object.url}
                              alt={object.name}
                              className="max-h-16 max-w-full rounded object-contain"
                            />
                          ) : (
                            <File
                              size={32}
                              className="text-muted-foreground"
                            />
                          )}
                        </div>

                        <p className="truncate text-xs font-medium">
                          {object.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(object.size)}
                        </p>

                        <div className="absolute top-2 right-2 hidden gap-1 group-hover:flex">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => void copyUrl(object)}
                            title="Copy URL"
                          >
                            {copiedId === object.id ? (
                              <Check size={10} />
                            ) : (
                              <Copy size={10} />
                            )}
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-6 w-6 hover:text-destructive"
                            onClick={() => void deleteObject(object.id)}
                            title="Delete"
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

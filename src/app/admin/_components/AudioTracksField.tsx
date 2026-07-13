"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { uploadAudio } from "@/app/admin/content/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Language } from "@/types/db";

export interface AudioTrackDraft {
  language_id: string;
  label: string;
  url: string;
  is_default: boolean;
}

interface AudioTracksFieldProps {
  languages: Language[];
  initial: AudioTrackDraft[];
  /** Unique prefix so input ids stay unique when several forms share a page. */
  idPrefix: string;
}

const selectCls =
  "w-full rounded-lg border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm text-mist-100 focus:border-royal-500";

/**
 * Repeater for dub audio tracks (mirrors the subtitle repeater).
 * Serializes rows into a hidden `audio_tracks_json` input consumed by the
 * movie/episode save actions. URL can be pasted (Bunny/CDN) or a file can be
 * uploaded to the public "media" bucket via the uploadAudio server action.
 */
export function AudioTracksField({ languages, initial, idPrefix }: AudioTracksFieldProps) {
  const [tracks, setTracks] = useState<AudioTrackDraft[]>(initial);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [, startUpload] = useTransition();

  const update = (i: number, patch: Partial<AudioTrackDraft>) =>
    setTracks((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  const setDefault = (i: number, checked: boolean) =>
    setTracks((prev) =>
      prev.map((t, j) =>
        j === i
          ? { ...t, is_default: checked }
          : { ...t, is_default: checked ? false : t.is_default },
      ),
    );

  const handleUpload = (i: number, file: File | null) => {
    if (!file) return;
    setUploadError(null);
    setUploadingIndex(i);
    startUpload(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadAudio(fd);
      if (res.ok) update(i, { url: res.data.url });
      else setUploadError(res.error);
      setUploadingIndex(null);
    });
  };

  // Fallback: empty label becomes "<Language> дубляж" so validation never trips.
  const serialized = tracks.map((t) => ({
    ...t,
    label:
      t.label.trim() ||
      `${languages.find((l) => l.id === t.language_id)?.name_mn ?? "Монгол"} дубляж`,
  }));

  return (
    <div className="space-y-3">
      <input type="hidden" name="audio_tracks_json" value={JSON.stringify(serialized)} />
      <p className="text-xs text-mist-500">
        Дуу оруулбал киноны эх дууг бүрэн орлуулж тоглоно. MP3, M4A, AAC, OGG (≤200MB) файл
        байршуулах эсвэл Bunny/CDN URL шууд оруулна.
      </p>
      {uploadError ? (
        <p role="alert" className="text-sm text-red-400">
          {uploadError}
        </p>
      ) : null}
      {tracks.map((track, i) => (
        <div key={i} className="space-y-3 rounded-lg border border-ink-700 bg-ink-900/60 p-3">
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_2fr_auto_auto]">
            <div className="space-y-1.5">
              <label
                htmlFor={`${idPrefix}-audio-lang-${i}`}
                className="block text-sm text-mist-300"
              >
                Хэл
              </label>
              <select
                id={`${idPrefix}-audio-lang-${i}`}
                value={track.language_id}
                onChange={(e) => update(i, { language_id: e.target.value })}
                className={selectCls}
              >
                <option value="">— Хэл —</option>
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name_mn}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Шошго"
              value={track.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Монгол дубляж"
            />
            <Input
              label="Дууны URL"
              value={track.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://..."
            />
            <label className="flex items-center gap-2 pb-2.5 text-sm text-mist-300">
              <input
                type="checkbox"
                checked={track.is_default}
                onChange={(e) => setDefault(i, e.target.checked)}
                className="h-4 w-4 accent-royal-500"
              />
              Үндсэн
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTracks((prev) => prev.filter((_, j) => j !== i))}
              aria-label="Дууны замыг устгах"
            >
              <Trash2 className="h-4 w-4 text-red-400" aria-hidden />
            </Button>
          </div>
          <label className="block text-sm text-mist-400">
            Аудио файл байршуулах
            <input
              type="file"
              accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg"
              onChange={(e) => handleUpload(i, e.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-xs text-mist-400 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-mist-200"
            />
          </label>
          {uploadingIndex === i ? <p className="text-sm text-royal-300">Байршуулж байна...</p> : null}
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          setTracks((prev) => [
            ...prev,
            { language_id: languages[0]?.id ?? "", label: "", url: "", is_default: prev.length === 0 },
          ])
        }
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Дуу нэмэх
      </Button>
    </div>
  );
}

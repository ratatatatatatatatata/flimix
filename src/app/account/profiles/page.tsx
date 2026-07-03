import { Baby, Check, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { t } from "@/lib/i18n";
import type { Profile } from "@/types/db";
import {
  createProfile,
  deleteProfile,
  renameProfile,
  toggleChildProfile,
} from "./actions";

const MAX_PROFILES = 5;

const errorMessages: Record<string, string> = {
  invalid_name: "Нэр буруу байна. 1-40 тэмдэгт байх ёстой.",
  invalid_profile: "Профайл олдсонгүй.",
  max_profiles: `Хамгийн ихдээ ${MAX_PROFILES} профайл үүсгэх боломжтой.`,
  last_profile: "Сүүлийн профайлыг устгах боломжгүй.",
  create_failed: "Профайл үүсгэхэд алдаа гарлаа.",
  update_failed: "Хадгалахад алдаа гарлаа.",
  delete_failed: "Устгахад алдаа гарлаа.",
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, params] = await Promise.all([requireUser(), searchParams]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", session.userId)
    .order("created_at", { ascending: true });

  const profiles = (data ?? []) as Profile[];
  const errorMessage = params.error ? errorMessages[params.error] : undefined;
  const canCreate = profiles.length < MAX_PROFILES;
  const canDelete = profiles.length > 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">{t.profiles}</h1>
        <p className="mt-1 text-sm text-mist-400">
          Гэр бүлийн гишүүн бүрд тусдаа профайл — хамгийн ихдээ {MAX_PROFILES}.
        </p>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-900/30 px-4 py-3 text-sm text-red-300"
        >
          {errorMessage}
        </p>
      ) : null}

      {profiles.length === 0 ? (
        <EmptyState
          title="Профайл алга байна"
          description="Доорх маягтаар анхны профайлаа үүсгэнэ үү."
        />
      ) : (
        <ul className="space-y-3">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="rounded-xl border border-ink-600 bg-ink-800 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-royal-700/30 font-semibold text-royal-300"
                  aria-hidden="true"
                >
                  {initials(profile.display_name) || "?"}
                </div>

                <form
                  action={renameProfile}
                  className="flex min-w-0 flex-1 items-center gap-2"
                >
                  <input type="hidden" name="profile_id" value={profile.id} />
                  <label className="sr-only" htmlFor={`name-${profile.id}`}>
                    {t.displayName}
                  </label>
                  <input
                    id={`name-${profile.id}`}
                    name="display_name"
                    defaultValue={profile.display_name}
                    maxLength={40}
                    required
                    className="w-full min-w-0 max-w-xs rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-mist-100 transition focus:border-royal-500"
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    aria-label="Нэр хадгалах"
                  >
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {t.save}
                  </Button>
                </form>

                <div className="flex items-center gap-2">
                  {profile.is_child_profile ? (
                    <Badge tone="accent">
                      <span className="inline-flex items-center gap-1">
                        <Baby className="h-3 w-3" aria-hidden="true" />
                        Хүүхдийн
                      </span>
                    </Badge>
                  ) : null}
                  <form action={toggleChildProfile}>
                    <input
                      type="hidden"
                      name="profile_id"
                      value={profile.id}
                    />
                    <input
                      type="hidden"
                      name="next_value"
                      value={profile.is_child_profile ? "false" : "true"}
                    />
                    <Button type="submit" variant="ghost" size="sm">
                      {profile.is_child_profile
                        ? "Энгийн болгох"
                        : "Хүүхдийн болгох"}
                    </Button>
                  </form>
                  {canDelete ? (
                    <form action={deleteProfile}>
                      <input
                        type="hidden"
                        name="profile_id"
                        value={profile.id}
                      />
                      <Button
                        type="submit"
                        variant="danger"
                        size="sm"
                        aria-label={`${profile.display_name} профайл устгах`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border border-ink-600 bg-ink-800 p-5">
        <h2 className="mb-3 font-medium text-white">Шинэ профайл нэмэх</h2>
        {canCreate ? (
          <form
            action={createProfile}
            className="flex flex-wrap items-center gap-3"
          >
            <label className="sr-only" htmlFor="new-profile-name">
              {t.displayName}
            </label>
            <input
              id="new-profile-name"
              name="display_name"
              placeholder="Профайлын нэр"
              maxLength={40}
              required
              className="w-full max-w-xs rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 transition focus:border-royal-500"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-mist-300">
              <input
                type="checkbox"
                name="is_child_profile"
                className="h-4 w-4 rounded border-ink-600 bg-ink-900 accent-royal-500"
              />
              Хүүхдийн профайл
            </label>
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Нэмэх
            </Button>
          </form>
        ) : (
          <p className="text-sm text-mist-400">
            Профайлын дээд хязгаарт ({MAX_PROFILES}) хүрсэн байна. Шинээр
            нэмэхийн тулд аль нэгийг устгана уу.
          </p>
        )}
      </section>
    </div>
  );
}

export const RIGHTS_BLOCK_MESSAGE =
  "Нийтлэх боломжгүй: баталгаажсан, хүчинтэй контентын эрх (content right) бүртгэгдээгүй байна. Эхлээд Эрхийн удирдлага хэсэгт эрх нэмж баталгаажуулна уу.";

/**
 * Publish guard toggle. FLIMIX owns the rights to its catalog, so the
 * approved-content-right requirement is OFF by default. Set
 * REQUIRE_CONTENT_RIGHTS=true in the environment to enforce it again.
 */
export function contentRightsRequired(): boolean {
  return process.env.REQUIRE_CONTENT_RIGHTS === "true";
}

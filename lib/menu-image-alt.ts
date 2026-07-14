export function menuImageAlt(kind: "bento" | "izakaya" | "home_bento" | "dinner", name: string) {
  if (kind === "bento") return `AI生成による「${name}」の弁当盛り付け完成イメージ`;
  if (kind === "home_bento") return `AI生成による家庭用弁当「${name}」の盛り付け完成イメージ`;
  if (kind === "izakaya") return `AI生成による「${name}」の一皿盛り付け完成イメージ`;
  return `保存した夜ご飯「${name}」のレシピ`;
}

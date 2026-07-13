export function menuImageAlt(kind: "bento" | "izakaya", name: string) {
  return kind === "bento"
    ? `AI生成による「${name}」の弁当盛り付け完成イメージ`
    : `AI生成による「${name}」の一皿盛り付け完成イメージ`;
}

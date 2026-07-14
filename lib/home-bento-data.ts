export type HomeBentoAgeGroup =
  | "toddler"
  | "elementary-low"
  | "elementary-middle"
  | "elementary-high"
  | "junior-high"
  | "high-school"
  | "twenties"
  | "thirties"
  | "forties"
  | "fifties"
  | "sixties"
  | "seventies"
  | "eighties";

export type HomeBentoGender = "male" | "female" | "all";

export const homeBentoAgeLabels: Record<HomeBentoAgeGroup, string> = {
  toddler: "幼児",
  "elementary-low": "小学生低学年",
  "elementary-middle": "小学生中学年",
  "elementary-high": "小学生高学年",
  "junior-high": "中学生",
  "high-school": "高校生",
  twenties: "20代",
  thirties: "30代",
  forties: "40代",
  fifties: "50代",
  sixties: "60代",
  seventies: "70代",
  eighties: "80代",
};

export const homeBentoGenderLabels: Record<HomeBentoGender, string> = {
  male: "男性",
  female: "女性",
  all: "指定なし",
};


import type { Grade } from "./types";

export const GRADE_MULTIPLIER: Record<Grade, number> = { A: 1, B: 0.9, C: 0.78 };

/** Harga unit untuk grade tertentu, dihitung dari harga grade A model yang sama. */
export function priceForGrade(basePriceGradeA: number, grade: Grade, multiplier = GRADE_MULTIPLIER): number {
  return Math.round((basePriceGradeA * multiplier[grade]) / 10_000) * 10_000;
}

/** Nominal transfer = harga + 3 digit kode unik supaya mudah dicocokkan admin. */
export function transferAmount(amount: number, uniqueCode: number): number {
  return Math.floor(amount / 1000) * 1000 + uniqueCode;
}

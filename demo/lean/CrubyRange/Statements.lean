import CrubyRange.Spec
import CrubyRange.Impl

/-!
# Propositions P1–P4 (statements only)

These are `Prop` definitions, not theorems: they state exactly what is
proved or refuted. The proofs are in `CrubyRange/Proofs.lean`.
All arithmetic and comparisons are over `Int` (no wrap-around).
-/

namespace CrubyRange

/-! ## P1: agreement with the specification (main goal) -/

/-- Wherever M_chk does not overflow, it agrees with S. -/
def P1 : Prop :=
  ∀ i : Input, i.Valid → mChk i ≠ .overflow → mChk i = (spec i).toChk

/-- For `err ∈ {0,2}` the result of S always fits in `long`. -/
def P1_repr : Prop :=
  ∀ i : Input, i.Valid → i.err ≠ 1 →
    ∀ b l, spec i = .ok b l → MIN ≤ b ∧ b ≤ MAX ∧ MIN ≤ l ∧ l ≤ MAX

/-! ## P3: arithmetic safety (main goal) -/

/-- O1: `end++` at `LONG_MAX` (range.c:1925). -/
def O1 (i : Input) : Prop :=
  0 ≤ specBeg i ∧ i.e = some MAX ∧ i.excl = false

/-- O2 (err = 1 only): `end - beg` below `LONG_MIN` (range.c:1932). -/
def O2 (i : Input) : Prop :=
  i.err = 1 ∧ 0 ≤ specBeg i ∧ specEnd i - specBeg i < MIN

/-- M_chk overflows exactly on O1 and O2. -/
def P3 : Prop :=
  ∀ i : Input, i.Valid → (mChk i = .overflow ↔ O1 i ∨ O2 i)

/-- Corollary: for `err ∈ {0,2}`, an exclusive range or an end other than
`LONG_MAX` never overflows. -/
def P3_safe : Prop :=
  ∀ i : Input, i.Valid → i.err ≠ 1 → (i.e ≠ some MAX ∨ i.excl = true) →
    mChk i ≠ .overflow

/-! ## P2: saturation at the upper end (element reads only) -/

/-- For `err = 0` and an inclusive range whose Integer end is at or past the
last index, the result equals that of the endless range. Stated for any model
`f`; expected to hold for S and to fail for M_wrap at `e = LONG_MAX`. -/
def P2 (f : Input → ChkOut) : Prop :=
  ∀ i : Input, i.Valid → i.err = 0 → i.excl = false →
    ∀ e, i.e = some e → i.n - 1 ≤ e → f i = f { i with e := none }

/-! ## P4: output contract (with a survey of what callers rely on) -/

/-- Candidate contract on an `ok` result; sums are evaluated in `Int`. -/
def Contract (i : Input) : ChkOut → Prop
  | .ok beg len =>
      0 ≤ beg ∧ 0 ≤ len ∧
        (if i.err = 1 then beg + len ≤ MAX else beg ≤ i.n ∧ beg + len ≤ i.n)
  | _ => True

/-- The model `f` satisfies the contract on every valid input. -/
def P4 (f : Input → ChkOut) : Prop :=
  ∀ i : Input, i.Valid → Contract i (f i)

end CrubyRange

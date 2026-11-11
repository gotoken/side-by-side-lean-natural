import CrubyRange.Basic

/-!
# Specification S

Over mathematical integers and independent of the statement order of the C
code. See `PROPERTIES.md` for the prose version.
-/

namespace CrubyRange

/-- Normalized start index B: negative values count from the end. -/
def specBeg (i : Input) : Int :=
  let b := i.b.getD 0
  if b < 0 then b + i.n else b

/-- Normalized exclusive end E. An endless range ends at `n`; an inclusive
range ends one past its last index. -/
def specEnd (i : Input) : Int :=
  match i.e with
  | none   => i.n
  | some e => (if e < 0 then e + i.n else e) + (if i.excl then 0 else 1)

/-- Specification S: the intended interval, as mathematical integers.

* `err ∈ {0,2}`: the selected indices are `[B, E) ∩ [0, n)`;
  a start past the end is out of range.
* `err = 1`: the interval `[B, E)` is not clipped at `n` (it may extend the
  receiver).

S always returns this mathematical interval. It does not model what should
happen when the interval does not fit in `long` (for `err = 1`, `len` or
`B + len` above `LONG_MAX`); in particular it does not raise. Whether results
are representable is examined separately (`P1_repr`, `P4`). -/
def spec (i : Input) : Out :=
  let B := specBeg i
  let E := specEnd i
  if B < 0 then .out
  else if i.err = 1 then .ok B (max (E - B) 0)
  else if i.n < B then .out
  else .ok B (max (min E i.n - B) 0)

end CrubyRange

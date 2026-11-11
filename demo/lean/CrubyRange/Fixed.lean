import CrubyRange.Spec
import CrubyRange.Impl

/-!
# The fix under test: ruby/ruby#19824

`patches/range-beg-len-overflow.patch` (commit d4d80a35 of
gotoken/ruby `fix-range-beg-len-overflow`, the head of ruby/ruby#19824)
changes two statements of `rb_range_component_beg_len`:

```c
    /* Include the end point.  RB_LEN_MAX + 1 is not representable, so
     * saturate instead of overflowing. */
    if (!excl && end < RB_LEN_MAX)
        end++;
    ...
    /* beg is non-negative here, so end - beg cannot overflow. */
    len = end > beg ? end - beg : 0;
```

and documents: "On success, `*begp` and `*lenp` are non-negative and their
sum does not exceed `RB_LEN_MAX`." (`fix_doc_contract` in `FixedProofs.lean`).

`bodyFixed` is `body` with exactly these two changes.
-/

namespace CrubyRange

/-- The patched function body, parameterised like `body`. -/
def bodyFixed (arith : Int → Option Int) (i : Input) : ChkOut :=
  let beg0 := i.b.getD 0
  let end0 := i.e.getD (-1)
  let excl := i.e.isSome && i.excl
  match (if beg0 < 0 then arith (beg0 + i.n) else some beg0) with
  | none => .overflow
  | some beg =>
    if beg < 0 then .out else
    match (if end0 < 0 then arith (end0 + i.n) else some end0) with
    | none => .overflow
    | some end1 =>
      -- if (!excl && end < RB_LEN_MAX) end++;
      match (if excl || decide (MAX ≤ end1) then some end1 else arith (end1 + 1)) with
      | none => .overflow
      | some end2 =>
        let clip := i.err == 0 || i.err == 2
        if clip && i.n < beg then .out else
        let end3 := if clip && i.n < end2 then i.n else end2
        -- len = end > beg ? end - beg : 0;
        if beg < end3 then
          match arith (end3 - beg) with
          | none => .overflow
          | some l => .ok beg l
        else .ok beg 0

/-- The patched function with checked arithmetic. -/
def mChkFixed (i : Input) : ChkOut :=
  bodyFixed checked i

/-- The patched function with 64-bit wrap-around (what the GCC build runs). -/
def mWrapFixed (i : Input) : ChkOut :=
  bodyFixed (fun x => some (wrap64 x)) i

/-- S with the exclusive end capped at `LONG_MAX`. It differs from S only for
`err = 1` on O1 inputs, where S's end `LONG_MAX + 1` is not representable. -/
def specSat (i : Input) : Out :=
  let B := specBeg i
  let E := min (specEnd i) MAX
  if B < 0 then .out
  else if i.err = 1 then .ok B (max (E - B) 0)
  else if i.n < B then .out
  else .ok B (max (min E i.n - B) 0)

end CrubyRange

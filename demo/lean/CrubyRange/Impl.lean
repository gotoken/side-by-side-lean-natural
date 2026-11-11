import CrubyRange.Basic

/-!
# Implementation models M_chk and M_wrap

Both follow `rb_range_component_beg_len` (range.c, ruby/ruby 1f2a4bd)
statement by statement; they differ only in how a `long` addition or
subtraction behaves.

```c
    beg = NIL_P(b) ? 0 : NUM2LEN(b);
    end = NIL_P(e) ? -1 : NUM2LEN(e);
    if (NIL_P(e)) excl = 0;
    if (beg < 0) {
        beg += len;
        if (beg < 0)
            goto out_of_range;
    }
    if (end < 0)
        end += len;
    if (!excl)
        end++;			/* include end point */
    if (err == 0 || err == 2) {
        if (beg > len)
            goto out_of_range;
        if (end > len)
            end = len;
    }
    len = end - beg;
    if (len < 0)
        len = 0;
```
-/

namespace CrubyRange

/-- `x` if it fits in `long`, otherwise `none` (signed overflow). -/
def checked (x : Int) : Option Int :=
  if MIN ≤ x ∧ x ≤ MAX then some x else none

/-- Two's-complement wrap-around to 64 bits. -/
def wrap64 (x : Int) : Int :=
  (x - MIN) % (2 ^ 64) + MIN

/-- The function body, parameterised by the result of each `long` `+`/`-`
(`none` = overflow). Comments quote the C statements. -/
def body (arith : Int → Option Int) (i : Input) : ChkOut :=
  -- beg = NIL_P(b) ? 0 : NUM2LEN(b);  end = NIL_P(e) ? -1 : NUM2LEN(e);
  let beg0 := i.b.getD 0
  let end0 := i.e.getD (-1)
  -- if (NIL_P(e)) excl = 0;
  let excl := i.e.isSome && i.excl
  -- if (beg < 0) { beg += len; if (beg < 0) goto out_of_range; }
  match (if beg0 < 0 then arith (beg0 + i.n) else some beg0) with
  | none => .overflow
  | some beg =>
    if beg < 0 then .out else
    -- if (end < 0) end += len;
    match (if end0 < 0 then arith (end0 + i.n) else some end0) with
    | none => .overflow
    | some end1 =>
      -- if (!excl) end++;
      match (if excl then some end1 else arith (end1 + 1)) with
      | none => .overflow
      | some end2 =>
        -- if (err == 0 || err == 2) { if (beg > len) goto out_of_range;
        --                             if (end > len) end = len; }
        let clip := i.err == 0 || i.err == 2
        if clip && i.n < beg then .out else
        let end3 := if clip && i.n < end2 then i.n else end2
        -- len = end - beg; if (len < 0) len = 0;
        match arith (end3 - beg) with
        | none => .overflow
        | some l => .ok beg (if l < 0 then 0 else l)

/-- M_chk: every `long` operation is checked; leaving `[MIN, MAX]` gives
`overflow`. Conservative with respect to the C semantics. -/
def mChk (i : Input) : ChkOut :=
  body checked i

/-- M_wrap: every `long` operation wraps around modulo 2^64. Matches the
generated code only when `-fno-strict-overflow` is in effect (CRuby's
configure adds it; checked with gcc 13 and clang 18); without it signed
overflow is undefined behaviour and this model does not apply. Never returns
`overflow`. -/
def mWrap (i : Input) : ChkOut :=
  body (fun x => some (wrap64 x)) i

end CrubyRange

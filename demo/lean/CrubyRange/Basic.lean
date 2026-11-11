/-!
# Common definitions

Target: `rb_range_component_beg_len` and `rb_range_beg_len` in `range.c`
of ruby/ruby `1f2a4bd5750bb3b685c24aee1fbd7530e895cf3f`, on an LP64
platform where `rb_len_t` is `long` (64 bits).
-/

namespace CrubyRange

/-- `LONG_MIN` on LP64. -/
def MIN : Int := -(2 ^ 63)

/-- `LONG_MAX` on LP64. -/
def MAX : Int := 2 ^ 63 - 1

/-- One call of `rb_range_component_beg_len(b, e, excl, &beg, &len, n, err)`.
Endpoints are Integers or `nil`; values that go through `#to_int` are out of scope. -/
structure Input where
  b    : Option Int
  e    : Option Int
  excl : Bool
  n    : Int
  err  : Nat
  deriving Repr, DecidableEq

/-- Inputs in scope: endpoints representable as `long` (otherwise `NUM2LEN`
raises before the function body runs), `0 ≤ n ≤ LONG_MAX`, `err ∈ {0,1,2}`. -/
def Input.Valid (i : Input) : Prop :=
  (∀ x, i.b = some x → MIN ≤ x ∧ x ≤ MAX) ∧
  (∀ x, i.e = some x → MIN ≤ x ∧ x ≤ MAX) ∧
  0 ≤ i.n ∧ i.n ≤ MAX ∧ i.err ≤ 2

/-- Result of `rb_range_component_beg_len`: `Qtrue` with `*begp`, `*lenp`
filled in, or `Qnil` (`goto out_of_range`). -/
inductive Out where
  | ok (beg len : Int)
  | out
  deriving Repr, DecidableEq

/-- Result of an implementation model that may hit signed overflow. -/
inductive ChkOut where
  | ok (beg len : Int)
  | out
  | overflow
  deriving Repr, DecidableEq

def Out.toChk : Out → ChkOut
  | .ok b l => .ok b l
  | .out    => .out

end CrubyRange

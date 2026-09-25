---
description: Sample spaces, operations on events, and Kolmogorov's axioms of probability.
---

# Events

## Sample spaces

The set of all possible outcomes of a random experiment is its **sample space**, written $\Omega$. For one roll of a die, $\Omega = \{1, 2, 3, 4, 5, 6\}$.

An **event** is a subset of $\Omega$. "Roll an even number" is the event $A = \{2, 4, 6\}$.

## Operations on events

Events combine like sets. In the figure, the overlap of the two circles is $A \cap B$.

![[events.svg|320]]

| Notation | Read as | Meaning |
| --- | --- | --- |
| $A \cup B$ | $A$ or $B$ | at least one happens |
| $A \cap B$ | $A$ and $B$ | both happen |
| $A^c$ | not $A$ | $A$ does not happen |
| $A \cap B = \varnothing$ | disjoint | they cannot both happen |

## Axioms of probability

> [!definition] Probability
> A function $\P$ assigns every event a number in $[0, 1]$ such that
> 1. $\P(\Omega) = 1$;
> 2. for pairwise disjoint events $A_1, A_2, \dots$, $\P\big(\bigcup_i A_i\big) = \sum_i \P(A_i)$.

> [!theorem] Inclusion–exclusion
> For any events $A$ and $B$,
> $$
> \P(A \cup B) = \P(A) + \P(B) - \P(A \cap B).
> $$

The subtracted term is exactly the overlap in the figure: $\P(A)$ and $\P(B)$ each counted it once.

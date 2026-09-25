---
description: The ε-δ language turns "arbitrarily close" into inequalities you can check.
---

# Limits

## Intuition

When $f(x)$ gets closer and closer to a number $L$ as $x$ approaches $a$, we call $L$ the limit of $f$ at $a$. The dashed line in the figure is that $L$.

![[limit.svg|360]]

## The precise definition

> [!definition] Limit
> Let $f$ be defined on a punctured neighbourhood of $a$. If for every $\varepsilon > 0$ there is a $\delta > 0$ such that $0 < |x - a| < \delta$ implies
> $$
> |f(x) - L| < \varepsilon,
> $$
> then $L$ is the **limit** of $f$ at $a$, written $\lim_{x \to a} f(x) = L$.

> [!warning] The value at the point does not matter
> The definition only looks at $x \neq a$. Whether $f(a)$ is defined, and what it equals, has no effect on the limit.

## An example

> [!example]- Prove that $\lim_{x \to 2} (3x + 1) = 7$
> Given $\varepsilon > 0$, choose $\delta = \varepsilon / 3$. Whenever $0 < |x - 2| < \delta$,
> $$
> |(3x + 1) - 7| = 3|x - 2| < 3\delta = \varepsilon.
> $$

## Limit laws

If $\lim_{x \to a} f(x) = L$ and $\lim_{x \to a} g(x) = M$, then

$$
\lim_{x \to a} \big(f(x) + g(x)\big) = L + M, \qquad \lim_{x \to a} f(x)\,g(x) = LM.
$$

With limits in hand, [[02-derivatives]] can be defined.

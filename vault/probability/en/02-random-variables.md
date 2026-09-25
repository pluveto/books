---
description: A random variable turns outcomes into numbers. This chapter defines expectation and variance and proves linearity of expectation.
---

# Random Variables

## Definition

A **random variable** is a function $X: \Omega \to \R$ from the sample space to the reals. It turns "what happened" into "how much we got".

## Expectation

The **expectation** of a discrete random variable $X$ is its probability-weighted average:

$$
\E[X] = \sum_{x} x \, \P(X = x).
$$

For a continuous random variable the sum becomes an integral, $\E[X] = \int_{-\infty}^{\infty} x f(x) \, \mathrm{d}x$, where $f$ is the density.

### Linearity of expectation

> [!theorem] Linearity
> For any random variables $X$, $Y$ and constants $a$, $b$,
> $$
> \E[aX + bY] = a\,\E[X] + b\,\E[Y].
> $$

No independence between $X$ and $Y$ is required. In the language of *Linear Algebra*, expectation preserves every [[01-vectors#Linear combinations|linear combination]].

> [!aside] Aside
> "aside" is not one of Obsidian's built-in callout types. The publisher still renders it, with a neutral colour.

## Variance

$$
\Var(X) = \E\big[(X - \E[X])^2\big] = \E[X^2] - \E[X]^2.
$$

Variance measures how far $X$ strays from its expectation. Its square root is the **standard deviation**.

## Simulation

```python
import random

rolls = [random.randint(1, 6) for _ in range(100_000)]
print(sum(rolls) / len(rolls))  # close to 3.5
```

The expected value of a die roll is $3.5$, and the simulated mean lands close to it. Event notation is in [[01-events#Operations on events]].

---
description: Define the derivative as a limit of difference quotients, list common derivatives and check one numerically.
---

# Derivatives

## Definition

> [!definition] Derivative
> If the limit
> $$
> f'(a) = \lim_{h \to 0} \frac{f(a + h) - f(a)}{h}
> $$
> exists, $f$ is **differentiable** at $a$ and $f'(a)$ is its **derivative** there.

Geometrically, $f'(a)$ is the slope of the tangent line at $(a, f(a))$. The notion of limit used here is the one from [[01-limits#The precise definition]].

## Common derivatives

| $f(x)$ | $f'(x)$ |
| --- | --- |
| $x^n$ | $n x^{n-1}$ |
| $e^x$ | $e^x$ |
| $\ln x$ | $1/x$ |
| $\sin x$ | $\cos x$ |

## A numerical check

For small $h$ the difference quotient approaches the derivative. This program uses a central difference to check that $\sin' = \cos$:

```ts
const derivative = (f: (x: number) => number, x: number, h = 1e-5): number =>
  (f(x + h) - f(x - h)) / (2 * h)

console.log(derivative(Math.sin, 0)) // ≈ 1 = cos(0)
```

> [!tip] Why a central difference
> The central difference has error $O(h^2)$; a one-sided difference has error $O(h)$. For the same $h$, the former is far more accurate.

## The chain rule

If $g$ is differentiable at $a$ and $f$ is differentiable at $g(a)$, then

$$
\frac{\dd}{\dd x} f\big(g(x)\big) \Big|_{x=a} = f'\big(g(a)\big)\, g'(a).
$$

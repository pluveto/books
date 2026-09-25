---
description: Starting from arrows in the plane, define vector spaces, linear combinations, length and the inner product.
---

# Vectors

## The geometric picture

In the plane, a vector is an arrow with a direction. Placing two arrows head to tail adds them; stretching, shrinking or flipping an arrow multiplies it by a scalar.

![[vector.svg|320]]

## Vector spaces

> [!definition] Vector space
> Let $V$ be a set with an addition $V \times V \to V$ and a scalar multiplication $\R \times V \to V$. If commutativity, associativity, a zero, negatives and the distributive laws hold for all $u, v, w \in V$ and $a, b \in \R$, then $V$ is a **vector space** over $\R$.

The most common example is $\R^n$: add componentwise and multiply every component by the same number.

## Linear combinations

> [!definition] Linear combination
> Given vectors $v_1, \dots, v_k$ and numbers $a_1, \dots, a_k$, the vector
> $$
> w = a_1 v_1 + a_2 v_2 + \cdots + a_k v_k
> $$
> is a **linear combination** of $v_1, \dots, v_k$.

The set of all linear combinations is the **span** of the vectors, written $\operatorname{span}(v_1, \dots, v_k)$.

## Length and inner product

The length of a vector in $\R^n$ comes from Pythagoras:

$$
\norm{v} = \sqrt{v_1^2 + v_2^2 + \cdots + v_n^2}.
$$

The inner product $\langle v, w \rangle = \sum_{i=1}^{n} v_i w_i$ satisfies $\langle v, v \rangle = \norm{v}^2$.

> [!example] Check it in code
> ```python
> import math
>
> def norm(v: list[float]) -> float:
>     return math.sqrt(sum(x * x for x in v))
>
> print(norm([3.0, 4.0]))  # 5.0
> ```

The next chapter writes linear combinations more compactly with matrices; see [[02-matrices#Matrix multiplication]].

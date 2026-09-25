---
description: A matrix is bookkeeping for linear combinations. This chapter defines matrix multiplication and proves associativity.
---

# Matrices

## Bookkeeping for linear combinations

Arrange vectors $v_1, \dots, v_n \in \R^m$ as columns to get the $m \times n$ matrix $A = (v_1 \; \cdots \; v_n)$. A linear combination then becomes a matrix–vector product:

$$
A x = x_1 v_1 + \cdots + x_n v_n.
$$

This is just another way to write a [[01-vectors#Linear combinations|linear combination]].

## Matrix multiplication

> [!definition] Matrix multiplication
> Let $A$ be an $m \times n$ matrix and $B$ an $n \times p$ matrix. The product $C = AB$ is the $m \times p$ matrix with entries
> $$
> c_{ij} = \sum_{k=1}^{n} a_{ik} b_{kj}.
> $$

For example,

$$
\begin{pmatrix} 1 & 2 \\ 0 & 1 \end{pmatrix}
\begin{pmatrix} 3 \\ 4 \end{pmatrix}
=
\begin{pmatrix} 11 \\ 4 \end{pmatrix}.
$$

> [!warning] Order matters
> In general $AB \neq BA$. Even when $AB$ is defined, $BA$ may not be defined at all.

## Associativity

> [!theorem] Associativity
> Whenever the products are defined, $(AB)C = A(BC)$.

> [!proof]- Proof
> Compare the $(i, j)$ entries of both sides:
> $$
> \big((AB)C\big)_{ij} = \sum_{l} \Big(\sum_{k} a_{ik} b_{kl}\Big) c_{lj} = \sum_{k} a_{ik} \Big(\sum_{l} b_{kl} c_{lj}\Big) = \big(A(BC)\big)_{ij}.
> $$
> The middle step only swaps the order of two finite sums.

## Common matrices

| Name | Condition | Example |
| --- | --- | --- |
| Identity $I$ | $AI = IA = A$ | $\begin{pmatrix} 1 & 0 \\ 0 & 1 \end{pmatrix}$ |
| Diagonal | off-diagonal entries are $0$ | $\operatorname{diag}(2, 3)$ |
| Symmetric | $A^\top = A$ | $\begin{pmatrix} 1 & 2 \\ 2 & 5 \end{pmatrix}$ |

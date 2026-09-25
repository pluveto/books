# Preface

Linear algebra studies objects that can be added and scaled, together with the maps that respect those two operations. It is the shared language of geometry, calculus, probability, statistics and machine learning.

## How to read this book

Every chapter unfolds in the same order: a picture, then a definition, then examples. Feel free to skip proofs on a first reading, but do not skip the examples.

> [!tip] Draw it first
> When you meet a new definition, draw it in the plane $\R^2$. Most statements that make sense in two dimensions generalize to $\R^n$ by notation alone.

## Notation

| Symbol | Meaning |
| --- | --- |
| $\R^n$ | the real vector space of dimension $n$ |
| $u, v, w$ | vectors |
| $A, B$ | matrices |
| $\norm{v}$ | the length of the vector $v$ |

Vectors are written as columns[^column], for example

$$
v = \begin{pmatrix} 1 \\ 2 \end{pmatrix}.
$$

[^column]: Some books use row vectors. The two conventions differ by a single transpose.

## How this book relates to the rest of the series

The rigorous definition of a limit lives in [[01-limits]] of *Calculus*. Linearity of expectation (see [[02-random-variables#Linearity of expectation]]) says, at heart, that expectation is a linear map.

When you are ready, start with [[01-vectors]].

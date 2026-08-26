# AWLA Practical Fidelity Benchmark

Decision: do one controlled FLUX.2 dev benchmark before building more infrastructure.

Why:
- Klein 4B already proved the pipeline works but product fidelity is below target.
- FLUX.2 dev is materially stronger and supports the same reference workflow.
- Do NOT build Vision Critic/revision automation until the generator proves it can preserve the product.

## Test protocol
Use `?engine=dev`, 10 steps, one 512x512 reference and 1024x1024 output.

Run only TWO candidates first.
Estimated neuron usage per candidate:
- input: 1 tile × 18.75 × 10 steps = 187.5 neurons
- output: 4 tiles × 37.5 × 10 steps = 1500 neurons
- total ≈ 1687.5 neurons/image
Two candidates ≈ 3375 neurons, well inside the 10,000-neuron daily free allocation.

If neither candidate materially improves product fidelity over Klein 4B, stop the free-fidelity route and move high-fidelity product editing to BYOK/premium. Do not waste more engineering time.

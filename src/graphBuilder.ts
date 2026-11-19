import type { Edge, Literal, Node } from '@pylinka/graph';

// One output port of a node, to wire into another node's input.
export interface PortRef {
  nodeId: string;
  portId: string;
}

type Constant = number | readonly [number, number];

// A port driven by a knob (a project param the app sets at runtime), with the value it takes until the app does.
// Knobs are bound straight onto ports rather than read through a param.ref node: Pylinka 2.1.0's WebGL2 code
// generator declares a param.ref's output as a float even for a vec2 knob, so its shader fails to compile.
export interface KnobInput {
  knob: string; // ParamDef.id
  value: Constant;
}

// An input is a constant (a number for f32 ports, a pair for vec2 ports), a knob, or a wire from another node.
export type Input = Constant | KnobInput | PortRef;

// Builds a Pylinka node graph in code. Writing the JSON by hand means pairing every edge with node and port ids
// by eye; this keeps each node and what feeds it on one line.
export class GraphBuilder {
  readonly nodes: Node[] = [];
  readonly edges: Edge[] = [];

  // Adds a node and returns its output port. Most nodes name their one output `out`; fields name it `force` (or
  // `drag`) and shapes `pos`, so pass `output` for those.
  add(kind: string, inputs: Record<string, Input> = {}, structural?: Record<string, string>, output = 'out'): PortRef {
    const nodeId = `n${this.nodes.length + 1}`;
    const values: Record<string, Literal> = {};
    const knobBindings: Record<string, string> = {};
    for (const [portId, input] of Object.entries(inputs)) {
      if (isConstant(input)) values[portId] = literal(input);
      else if ('knob' in input) {
        values[portId] = literal(input.value); // a bound port still needs a value, which also gives it its type
        knobBindings[portId] = input.knob;
      } else this.edges.push({ id: `e${this.edges.length + 1}`, from: input, to: { nodeId, portId } });
    }
    this.nodes.push({
      id: nodeId,
      kind,
      ...(Object.keys(values).length > 0 ? { values } : {}),
      ...(Object.keys(knobBindings).length > 0 ? { knobBindings } : {}),
      ...(structural ? { structural } : {}),
    });
    return { nodeId, portId: output };
  }
}

function isConstant(input: Input): input is Constant {
  return typeof input === 'number' || Array.isArray(input);
}

function literal(value: Constant): Literal {
  return typeof value === 'number' ? { t: 'f32', v: value } : { t: 'vec2', v: [value[0], value[1]] };
}

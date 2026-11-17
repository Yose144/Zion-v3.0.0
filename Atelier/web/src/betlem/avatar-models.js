// The keys describe places in the older Atelier scene. Values are IDs in
// V31/L4/oasis/data/avatars.json, which match the filenames used by Nirvana.
export const MODEL_IDS = Object.freeze({
  "OASIS-049": 40, // Lumi
  "OASIS-046": 43, // Malý princ
  "OASIS-002": 1,  // Rama
  "OASIS-003": 2,  // Sita
  "scene:Marie Magdaléna": 18,
  "OASIS-019": 19, // Ježíš z Nazareta
});

export function parseAvatar(bytes) {
  const view = new DataView(bytes);
  const header = view.getUint32(12, true);
  const binary = 28 + header;
  if (view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== bytes.byteLength ||
      view.getUint32(16, true) !== 0x4e4f534a ||
      view.getUint32(binary - 4, true) !== 0x004e4942) {
    throw new Error("Neplatný GLB.");
  }
  const document = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, header)));
  const [rootId] = document.scenes[document.scene ?? 0].nodes;
  const root = document.nodes[rootId];
  const mesh = root.children.map(id => document.nodes[id]).find(node => node.mesh !== undefined);
  const [primitive, extra] = document.meshes[mesh.mesh].primitives;
  // These exports share one opaque, textured mesh in the bind pose. Keep the
  // supported shape explicit so different future exports retain the fallback.
  const [qx, qy, qz, qw] = root.rotation ?? [0, 0, 0, 1];
  if (extra || document.extensionsRequired?.length || (primitive.mode ?? 4) !== 4 ||
      root.translation || root.matrix || root.scale || mesh.translation || mesh.rotation ||
      mesh.scale || mesh.matrix || Math.abs(qx) > 1e-6 || Math.abs(qz) > 1e-6) {
    throw new Error("Nepodporovaný export avatara.");
  }
  function bufferView(index) {
    const part = document.bufferViews[index];
    const start = binary + (part.byteOffset ?? 0);
    if (part.buffer !== 0 || start + part.byteLength > bytes.byteLength) throw new Error("Neúplný GLB.");
    return [part, start];
  }
  function read(index, type, components, TypedArray, componentType) {
    const accessor = document.accessors[index];
    const [part, start] = bufferView(accessor.bufferView);
    const offset = accessor.byteOffset ?? 0;
    if (accessor.type !== type || accessor.componentType !== componentType || accessor.sparse ||
        part.byteStride || offset + accessor.count * components * TypedArray.BYTES_PER_ELEMENT > part.byteLength) {
      throw new Error("Nepodporovaný formát geometrie.");
    }
    return new TypedArray(bytes, start + offset, accessor.count * components);
  }
  const { POSITION, NORMAL, TEXCOORD_0 } = primitive.attributes;
  const positions = read(POSITION, "VEC3", 3, Float32Array, 5126);
  const normals = read(NORMAL, "VEC3", 3, Float32Array, 5126);
  const uv = read(TEXCOORD_0, "VEC2", 2, Float32Array, 5126);
  const indices = read(primitive.indices, "SCALAR", 1, Uint16Array, 5123);
  const material = document.materials[primitive.material];
  const texture = document.textures[material.pbrMetallicRoughness.baseColorTexture.index];
  const image = document.images[texture.source];
  const [part, start] = bufferView(image.bufferView);
  const bounds = document.accessors[POSITION];
  if (!bounds.min || !bounds.max || !(bounds.max[1] > bounds.min[1]) ||
      positions.length !== normals.length || uv.length / 2 !== positions.length / 3 ||
      indices.some(index => index >= positions.length / 3)) throw new Error("Neplatná geometrie.");
  return {
    positions, normals, uv, indices,
    image: new Blob([new Uint8Array(bytes, start, part.byteLength)], { type: image.mimeType }),
    min: bounds.min, max: bounds.max,
    // The repository's avatar QA views face +X. Turn that side toward the
    // entrance (+Z) after applying the exported root transform.
    yaw: 2 * Math.atan2(qy, qw) - Math.PI / 2,
  };
}

export function createAvatarRenderer(gl, compileShader) {
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, `
    attribute vec3 point, normal;
    attribute vec2 uv;
    uniform vec3 eye, right, up, forward, origin;
    uniform vec2 scale, turn;
    uniform float factor;
    varying vec2 texcoord;
    varying vec3 worldNormal, worldPoint;
    varying float depth;
    vec3 rotate(vec3 p) {
      return vec3(turn.x*p.x+turn.y*p.z,p.y,-turn.y*p.x+turn.x*p.z);
    }
    void main() {
      worldPoint=origin+rotate(point)*factor;
      worldNormal=rotate(normal);
      vec3 p=worldPoint-eye;
      depth=dot(p,forward);
      texcoord=uv;
      gl_Position=vec4(dot(p,right)*scale.x,dot(p,up)*scale.y,depth*1.002-0.20,depth);
    }
  `));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    uniform sampler2D albedo;
    varying vec2 texcoord;
    varying vec3 worldNormal, worldPoint;
    varying float depth;
    void main() {
      vec3 n=normalize(worldNormal);
      float light=.62+.38*max(dot(n,normalize(vec3(-.5,1.,.6))),0.);
      float glow=.22*exp(-distance(worldPoint,vec3(0.,1.,9.))/7.);
      vec3 paint=texture2D(albedo,texcoord).rgb*light+glow*vec3(1.,.6,.2);
      float haze=smoothstep(19.,155.,depth);
      gl_FragColor=vec4(mix(paint,vec3(.105,.159,.226),haze*.8),1.);
    }
  `));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const uniforms = Object.fromEntries(
    ["eye","right","up","forward","origin","scale","turn","factor","albedo"]
      .map(name => [name,gl.getUniformLocation(program,name)])
  );
  const attributes = ["point","normal","uv"].map(name => gl.getAttribLocation(program,name));

  async function load(id, placement) {
    const response = await fetch("/betlem/model/" + id + ".glb", { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error("GLB se nepodařilo načíst.");
    const data = parseAvatar(await response.arrayBuffer());
    const bitmap = await createImageBitmap(data.image);
    const buffers = [];
    const texture = gl.createTexture();
    try {
      for (const [target, array] of [
        [gl.ARRAY_BUFFER, data.positions],
        [gl.ARRAY_BUFFER, data.normals],
        [gl.ARRAY_BUFFER, data.uv],
        [gl.ELEMENT_ARRAY_BUFFER, data.indices],
      ]) {
        const buffer = gl.createBuffer();
        buffers.push(buffer);
        gl.bindBuffer(target,buffer);
        gl.bufferData(target,array,gl.STATIC_DRAW);
      }
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Texturu nelze vykreslit.");
    } catch (error) {
      buffers.forEach(buffer => gl.deleteBuffer(buffer));
      gl.deleteTexture(texture);
      throw error;
    } finally {
      bitmap.close();
    }
    const factor = placement.height / (data.max[1] - data.min[1]);
    return { buffers, texture, count: data.indices.length, factor,
      origin: [placement.x, -data.min[1]*factor, placement.z],
      turn: [Math.cos(data.yaw), Math.sin(data.yaw)] };
  }

  function draw(models, eye, right, up, forward, scale) {
    gl.useProgram(program);
    for (const [name, value] of Object.entries({ eye,right,up,forward })) gl.uniform3fv(uniforms[name],value);
    gl.uniform2fv(uniforms.scale,scale);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(uniforms.albedo,0);
    for (const model of models.values()) {
      attributes.forEach((index,i) => {
        gl.bindBuffer(gl.ARRAY_BUFFER,model.buffers[i]);
        gl.enableVertexAttribArray(index);
        gl.vertexAttribPointer(index,i===2?2:3,gl.FLOAT,false,0,0);
      });
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,model.buffers[3]);
      gl.bindTexture(gl.TEXTURE_2D,model.texture);
      gl.uniform3fv(uniforms.origin,model.origin);
      gl.uniform2fv(uniforms.turn,model.turn);
      gl.uniform1f(uniforms.factor,model.factor);
      gl.drawElements(gl.TRIANGLES,model.count,gl.UNSIGNED_SHORT,0);
    }
    attributes.forEach(index => gl.disableVertexAttribArray(index));
  }

  return { load, draw };
}

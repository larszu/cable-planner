// Ein Material fuer den ganzen detaillierten Menschen — die Planer geben
// `mesh.material` als einzelnes Material frei, also kein Material-Array.
// Haut, Stoff und Haar unterscheiden sich ueber das Attribut `teil`:
// Haut mit Wrap-Licht (Licht dringt ueber die Schattengrenze, roetlich —
// die billige Form von Subsurface Scattering), Stoff mit Sheen, Haar mit
// Anisotropie quer zur Straehne. Ruhebewegung (Atmen, Gewichtsverlagerung)
// im Vertex-Shader aus der Szenenzeit: kein Skelett, keine CPU-Arbeit.
import * as THREE from 'three'
import { SZENEN_ZEIT } from './dunst'

const VERT_KOPF = /* glsl */ `
  attribute float teil;
  attribute float atem;
  uniform float uZeit;
  uniform float uRuhe;
  uniform float uPhase;
  uniform float uBasis;
  varying float vHaut;
  varying float vStoff;
  varying float vHaar;
  varying float vRau;
`

const FRAG_KOPF = /* glsl */ `
  varying float vHaut;
  varying float vStoff;
  varying float vHaar;
  varying float vRau;
`

// Rauheit je Teil, Reihenfolge wie TEIL_DETAIL.
const RAU = [0.5, 0.86, 0.82, 0.42, 0.42, 0.5, 0.8, 0.08, 0.05, 0.36, 0.75, 0.32]

export interface MenschMaterialOptionen {
  /** Staerke der Ruhebewegung, 0 = still. */
  ruhe?: number
  /** 0..1, verschiebt die Bewegung je Person. */
  phase?: number
  /** Hoehe, ab der sich der Koerper wiegt (Sitzflaeche), in m. */
  basis?: number
}

export function menschMaterial(o: MenschMaterialOptionen = {}): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.6,
    metalness: 0,
    sheen: 1,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0.5, 0.5, 0.5),
    anisotropy: 0.65,
  })
  const uRuhe = { value: o.ruhe ?? 0 }
  const uPhase = { value: o.phase ?? 0 }
  const uBasis = { value: o.basis ?? 0 }
  mat.userData.ruhe = uRuhe
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uZeit = SZENEN_ZEIT
    shader.uniforms.uRuhe = uRuhe
    shader.uniforms.uPhase = uPhase
    shader.uniforms.uBasis = uBasis
    const rau = RAU.map((r, i) => `teil < ${i}.5 ? ${r.toFixed(2)} : `).join('') + '0.6'
    shader.vertexShader = VERT_KOPF + shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
        vHaut = (teil < 0.5 || abs(teil - 9.0) < 0.5) ? 1.0 : 0.0;
        vStoff = ((teil > 0.5 && teil < 2.5) || abs(teil - 6.0) < 0.5) ? 1.0 : 0.0;
        vHaar = abs(teil - 3.0) < 0.5 ? 1.0 : 0.0;
        vRau = ${rau};
        if (uRuhe > 0.0) {
          float w = uZeit * 1.35 + uPhase * 6.2832;
          transformed += objectNormal * atem * sin(w) * 0.004 * uRuhe;
          float h = max(0.0, position.y - uBasis);
          float s = uZeit * 0.23 + uPhase * 17.0;
          transformed.x += uRuhe * h * (sin(s) * 0.006 + sin(s * 2.7) * 0.002);
          transformed.z += uRuhe * h * sin(s * 0.71) * 0.003;
        }`,
    )
    shader.fragmentShader = FRAG_KOPF + shader.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = vRau;')
      .replace(
        '#include <lights_physical_fragment>',
        /* glsl */ `#include <lights_physical_fragment>
        #ifdef USE_SHEEN
          material.sheenColor *= vStoff * (0.35 + 0.65 * diffuseColor.rgb);
        #endif
        #ifdef USE_ANISOTROPY
          material.anisotropy *= vHaar;
          material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
        #endif`,
      )
      .replace(
        '#include <lights_physical_pars_fragment>',
        THREE.ShaderChunk.lights_physical_pars_fragment.replace(
          'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );',
          /* glsl */ `vec3 hautLicht = saturate( ( dot( geometryNormal, directLight.direction ) + vec3( 0.5, 0.26, 0.2 ) ) / vec3( 1.5, 1.26, 1.2 ) ) * directLight.color;
          reflectedLight.directDiffuse += mix( irradiance, hautLicht, vHaut ) * BRDF_Lambert( material.diffuseContribution );`,
        ),
      )
  }
  mat.customProgramCacheKey = () => 'avplan-mensch'
  return mat
}

import ThreeGeo from '../../../src';

const { THREE } = window;

var camera = null;

// Shader code
const constantColorShader = {
  uniforms: {
    color: { value: new THREE.Color(0xff0000) } // Default red color
  },
  vertexShader: `
    void main() {
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 color;

    void main() {
      gl_FragColor = vec4(color, 1.0); // Constant color with full opacity
    }
  `
};

// Create the material
const basicMaterial = new THREE.ShaderMaterial({
  uniforms: constantColorShader.uniforms,
  vertexShader: constantColorShader.vertexShader,
  fragmentShader: constantColorShader.fragmentShader
});

class Loader {
    constructor(scene, env, camera) {
        camera = camera;
        this._scene = scene;
        this._camera = camera;
        this._tgeo = new ThreeGeo({
            unitsSide: 1.0,
            tokenMapbox: env.tokenMapbox,
        });

        this.doneVec = false;
        this.doneRgb = false;
        this._rgbMats = {};
        this._interactives = [];
    }

    projection(ll, radius) {
        return this._tgeo.getProjection(ll, radius);
    }

    async getVecTerrain(origin, radius, zoom, refresh) {
        this.doneVec = true;

        this._scene.add(await this._tgeo.getTerrainVector(origin, radius, zoom));
        refresh();
    }

    getRgbTerrain(origin, radius, zoom, refresh) {
        this.doneRgb = true;

        return new Promise((res, rej) => {
            try {
                this._tgeo.getTerrain(origin, radius, zoom, {
                    onRgbDem: objs => objs.forEach(obj => { // dem-rgb-<zoompos>
                        this._interactives.push(obj);
                        this._scene.add(obj);
                        refresh();
                    }),
                    onSatelliteMat: plane => { // to be called *after* `onRgbDem`
                        console.log("Got satellite mat plane");
                        console.log(plane);
                        plane.material = basicMaterial;

                        this._rgbMats[plane.name] = plane.material;
                        refresh();
                        res();
                    },
                });
            } catch (err) { rej(err); }
        });
    }

    setDebugApis(title) {
        let loc = 'invalid';
        if (title.includes('Table')) loc = 'table';
        if (title.includes('Eiger')) loc = 'eiger';
        if (title.includes('River')) loc = 'river';
        if (title.includes('Akagi')) loc = 'akagi';

        this._tgeo.setApiVector(`../../cache/${loc}/custom-terrain-vector`);
        this._tgeo.setApiRgb(`../../cache/${loc}/custom-terrain-rgb`);
        this._tgeo.setApiSatellite(`../../cache/${loc}/custom-satellite`);
    }

    getRgbMaterials() {
        return this._rgbMats;
    }

    clearRgbMaterials() {
        Object.entries(this._rgbMats).forEach(([k, mat]) => {
            delete this._rgbMats[k];
            Loader.disposeMaterial(mat);
        });
    }

    clearInteractives() {
        this._interactives.length = 0;
    }

    interact(fn) {
        return Loader._apply(this._interactives, fn);
    }

    static _apply(meshes, fn) {
        const visibilities = {};

        meshes.forEach(mesh => {
            visibilities[mesh.uuid] = mesh.visible; // save
            mesh.visible = true;                    // force visible for raycast
        });

        const output = fn(meshes);                  // apply

        meshes.forEach(mesh => {
            mesh.visible = visibilities[mesh.uuid]; // restore
        });

        return output;
    }

    static disposeMaterial(mat) {
        if (mat.map) mat.map.dispose();
        mat.dispose();
    }

    static disposeObject(obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) this.disposeMaterial(obj.material);
        if (obj.texture) obj.texture.dispose();
    }
}

export default Loader;

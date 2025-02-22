import Stats from "stats.js";
import * as THREE from "three";
import * as WEBIFC from "web-ifc";
import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";

// Szenen-Setup
const container = document.getElementById("container")!;
const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);
const world = worlds.create<
  OBC.SimpleScene,
  OBC.SimpleCamera,
  OBC.SimpleRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.renderer = new OBC.SimpleRenderer(components, container);
world.camera = new OBC.SimpleCamera(components);

components.init();
world.camera.controls.setLookAt(12, 6, 8, 0, 0, -10);
world.scene.setup();

const grids = components.get(OBC.Grids);
grids.create(world);

// Hintergrund auf transparent setzen
world.scene.three.background = null;

// IFC-Datei von lokalem Computer laden mit IfcLoader
const fragments = components.get(OBC.FragmentsManager);
const fragmentIfcLoader = components.get(OBC.IfcLoader);
const fragmentBbox = components.get(OBC.BoundingBoxer);

let bbox: THREE.Object3D | null = null;
let model: THREE.Object3D | null = null;

// IFC-Loader konfigurieren
async function setupIfcLoader() {
  await fragmentIfcLoader.setup();

  // Optional: Kategorien ausschließen (z.B. Bewehrung)
  const excludedCats = [
    WEBIFC.IFCTENDONANCHOR,
    WEBIFC.IFCREINFORCINGBAR,
    WEBIFC.IFCREINFORCINGELEMENT,
  ];

  for (const cat of excludedCats) {
    fragmentIfcLoader.settings.excludedCategories.add(cat);
  }

  // Modell zur Szene verschieben (z.B. Ursprung setzen)
  fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
}

// Lokale IFC-Datei öffnen
const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.accept = ".ifc";
fileInput.style.display = "none";
document.body.appendChild(fileInput);

fileInput.addEventListener("change", async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const buffer = new Uint8Array(e.target!.result as ArrayBuffer);
    
    // Altes Modell entfernen, falls vorhanden
    if (model) {
      world.scene.three.remove(model);
    }

    try {
      // Neues Modell laden
      let model = await fragmentIfcLoader.load(buffer);
      
      if (!model) {
        console.error("Fehler: Modell konnte nicht geladen werden.");
        return;
      }

      model.name = "IFC-Modell";
      world.scene.three.add(model);

      // Bounding Box berechnen
      fragmentBbox.reset();
      fragmentBbox.add(model);
      bbox = fragmentBbox.getMesh();

      console.log("Modell erfolgreich geladen:", model);
    } catch (error) {
      console.error("Fehler beim Laden des IFC-Modells:", error);
    }
  };

  reader.readAsArrayBuffer(file);
});

// IFC-Loader Setup aufrufen
setupIfcLoader();

BUI.Manager.init();

// UI-Panel 
const panel = BUI.Component.create<BUI.PanelSection>(() => {
  return BUI.html`
    <bim-panel class="options-menu">
      
         
        <bim-button 
          label="Lade IFC-Datei" 
          @click="${() => fileInput.click()}">  
        </bim-button>
        
        <bim-button 
          label="Fit BIM model" 
          @click="${() => {
            if (bbox) {
              world.camera.controls.fitToSphere(bbox, true);
            } else {
              console.warn("Kein Modell geladen, Fit nicht möglich.");
            }
          }}">  
        </bim-button>  

      
    </bim-panel>
    `;
});

document.body.append(panel);

// Performance-Messung mit Stats.js
const stats = new Stats();
stats.showPanel(2);
document.body.append(stats.dom);
stats.dom.style.left = "0px";
stats.dom.style.zIndex = "unset";
world.renderer.onBeforeUpdate.add(() => stats.begin());
world.renderer.onAfterUpdate.add(() => stats.end());

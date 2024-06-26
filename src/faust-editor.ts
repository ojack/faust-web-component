import { icon } from "@fortawesome/fontawesome-svg-core"
import { FaustMonoDspGenerator, FaustPolyDspGenerator, IFaustMonoWebAudioNode } from "@grame/faustwasm"
import { FaustUI } from "@shren/faust-ui"
import faustCSS from "@shren/faust-ui/dist/esm/index.css?inline"
import Split from "split.js"
import { faustPromise, audioCtx, compiler, svgDiagrams, default_generator, get_mono_generator, get_poly_generator, getInputDevices, deviceUpdateCallbacks, accessMIDIDevice, midiInputCallback, extractMidiAndNvoices } from "./common"
import { createEditor, setError, clearError } from "./editor"
import { Scope } from "./scope"
import faustSvg from "./faustText.svg"

// default colors, can be overridden by specificying CSS variables on element
const COLORS = {
    backgroundColor: 'orange',
    color: 'white',
    graphColor: '#333'
}

const template = document.createElement("template")
template.innerHTML = `
<div id="root">
    <div id="controls">
        <button title="Run" class="button" id="run" disabled>${icon({ prefix: "fas", iconName: "play" }).html[0]}</button>
        <button title="Stop" class="button" id="stop" disabled>${icon({ prefix: "fas", iconName: "stop" }).html[0]}</button>
        <a title="Open in Faust IDE" id="ide" href="https://faustide.grame.fr/" class="button" target="_blank">${icon({ prefix: "fas", iconName: "up-right-from-square" }).html[0]}</a>
        <select id="audio-input" class="dropdown" disabled>
            <option>Audio input</option>
        </select>
        <!-- TODO: MIDI input
        <select id="midi-input" class="dropdown" disabled>
            <option>MIDI input</option>
        </select>
        -->
        <!-- TODO: volume control? <input id="volume" type="range" min="0" max="100"> -->
       <!-- <a title="Faust website" id="faust" href="https://faust.grame.fr/" target="_blank"><img src="${faustSvg}" height="15px" /></a> -->
    </div>
    <div id="content">
        <div id="editor"></div>
        <div id="sidebar">
            <div id="sidebar-buttons">
                <button title="Controls" id="tab-ui" class="button tab" disabled>${icon({ prefix: "fas", iconName: "sliders" }).html[0]}</button>
                <button title="Block Diagram" id="tab-diagram" class="button tab" disabled>${icon({ prefix: "fas", iconName: "diagram-project" }).html[0]}</button>
                <button title="Scope" id="tab-scope" class="button tab" disabled>${icon({ prefix: "fas", iconName: "wave-square" }).html[0]}</button>
                <button title="Spectrum" id="tab-spectrum" class="button tab" disabled>${icon({ prefix: "fas", iconName: "chart-line" }).html[0]}</button>
            </div>
            <div id="sidebar-content">
                <div id="faust-ui"></div>
                <div id="faust-diagram"></div>
                <div id="faust-scope"></div>
                <div id="faust-spectrum"></div>
            </div>
        </div>
    </div>
</div>
<style>
    :host {
        --main-bg-color: ${COLORS.backgroundColor};
        --main-color: ${COLORS.color};
        --main-graph-color: ${COLORS.graphColor};
    }

    #root {
        border: 1px solid var(--main-color);
       /* border-radius: 5px; */
        border-radius: 0px;
        box-sizing: border-box;
    }

    *, *:before, *:after {
        box-sizing: inherit; 
    }

    #controls {
      /*  background-color: #384d64; */
        background-color: var(--main-bg-color);
        border-bottom: 1px solid var(--main-color);
        display: flex;
    }

    #faust {
        margin-left: auto;
        margin-right: 10px;
        display: flex;
        align-items: center;
    }

    #faust-ui {
        width: 232px;
        max-height: 150px;
    }

    /*.faust-ui-group {
        background-color: var(--main-bg-color);
    }*/

    #faust-scope, #faust-spectrum {
        min-width: 232px;
        min-height: 150px;
    }

    #faust-diagram {
        max-width: 232px;
        height: 150px;
    }

    #content {
        display: flex;
    }

    #editor {
        flex-grow: 1;
        overflow-y: auto;
    }

    #editor .cm-editor {
        height: 100%;
    }

    .cm-diagnostic {
        font-family: monospace;
    }

    .cm-diagnostic-error {
        background-color: #fdf2f5 !important;
        color: #a4000f !important;
        border-color: #a4000f !important;
    }

    #sidebar {
        display: flex;
        max-width: 100%;
    }

    .tab {
        flex-grow: 1;
    }

    #sidebar-buttons .tab.active {
       /* background-color: #bbb; */
       background-color: var(--main-color);
       color:  var(--main-bg-color);
    }

    #sidebar-buttons {
        /* background-color: #f5f5f5;*/
        background-color: var(--main-bg-color);

        display: flex;
        flex-direction: column;
    }

    #sidebar-buttons .button {
       /* background-color: #f5f5f5;*/
       background-color: var(--main-bg-color);
      /*  color: #000; */
      color: var(--main-color);
        width: 20px;
        height: 20px;
        padding: 4px;
    }

    #sidebar-buttons .button:hover {
        background-color: #ddd;
    }

    #sidebar-buttons .button:active {
        background-color: #aaa;
    }

    #sidebar-content {
      /*  background-color: #fff; */
      background-color: var(--main-bg-color);
     /*   border-left: 1px solid #ccc; */
     border-left: 1px solid var(main-color);
        overflow: auto;
        flex-grow: 1;
        max-height: 100%;
    }

    #sidebar-content > div {
        display: none;
    }

    #sidebar-content > div.active {
        display: block;
    }

    a.button {
        appearance: button;
    }

    .button {
      /*  background-color: #384d64; */
     /* background-color: #ccc; */
     background-color: var(--main-bg-color);
     color: var(--main-color);
        border: 0;
        padding: 5px;
        width: 25px;
        height: 25px;
    }

    .button:hover {
      /*  background-color: #4b71a1; */
      background-color: #f36;
    }

    .button:active {
      /*  background-color: #373736; */
        background-color: var(--main-color);
        color: var(--main-bg-color);


    }

    .button:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        pointer-events: none;
    }

    #controls > .button > svg {
        width: 15px;
        height: 15px;
        vertical-align: top;
    }

    .dropdown {
        height: 19px;
        margin: 3px 0 3px 10px;
        border: 0;
        background: var(--main-bg-color);
        color: var(--main-color);
    }

    .gutter {
       /* background-color: #f5f5f5; */
       background-color: var(--main-bg-color);
        border: solid 1px var(--main-color);
        background-repeat: no-repeat;
        background-position: 50%;
    }
    
    .gutter.gutter-horizontal {
        background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAeCAYAAADkftS9AAAAIklEQVQoU2M4c+bMfxAGAgYYmwGrIIiDjrELjpo5aiZeMwF+yNnOs5KSvgAAAABJRU5ErkJggg==');
        cursor: col-resize;
    }

    ${faustCSS}
</style>
`

export default class FaustEditor extends HTMLElement {
    node: IFaustMonoWebAudioNode
    input: MediaStreamAudioSourceNode | undefined
    analyser: AnalyserNode | undefined
    scope: Scope | undefined
    spectrum: Scope | undefined
    gmidi = false
    gnvoices = -1
    sourceNode: AudioBufferSourceNode | undefined = undefined

    constructor() {
        super()
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(
          `Attribute ${name} has changed from ${oldValue} to ${newValue}.`,
        );
      }

    setCode(_code) {
        const code = this.innerHTML.replace("<!--", "").replace("-->", "").trim()
        this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true))

    }

    async run() {
        // let node: IFaustMonoWebAudioNode | undefined
        // let input: MediaStreamAudioSourceNode | undefined
        // let analyser: AnalyserNode | undefined
        // let scope: Scope | undefined
        // let spectrum: Scope | undefined
        // let gmidi = false
        // let gnvoices = -1
        // let sourceNode: AudioBufferSourceNode | undefined = undefined;
       const { setSVG, audioInputSelector, stopButton, updateInputDevices, connectInput, openTab, editor, runButton, faustUIRoot, faustDiagram, sidebar, sidebarContent, tabButtons, tabContents, split, openSidebar } = this.localElements

        if (audioCtx.state === "suspended") {
            await audioCtx.resume()
        }
        await faustPromise
        // Compile Faust code
        const code = editor.state.doc.toString()
        let generator = null
        try {
            // Compile Faust code to access JSON metadata
            await default_generator.compile(compiler, "main", code, "")
            const json = default_generator.getMeta()
            console.log('compiled code', json)
            let event = new CustomEvent('faust-code-compiled', {
                bubbles: true,
                cancelable: true,
                detail: json
            })
            this.dispatchEvent(event)
            let { midi, nvoices } = extractMidiAndNvoices(json);
            this.gmidi = midi;
            this.gnvoices = nvoices;

            // Build the generator
            generator = nvoices > 0 ? get_poly_generator() : get_mono_generator();
            await generator.compile(compiler, "main", code, "-ftz 2");

        } catch (e: any) {
            setError(editor, e)
            return
        }
        // Clear any old errors
        clearError(editor)

        // Create an audio node from compiled Faust
        if (this.node !== undefined) this.node.disconnect()
        if (this.gnvoices > 0) {
            this.node = (await (generator as FaustPolyDspGenerator).createNode(audioCtx, gnvoices))!
        } else {
            this.node = (await (generator as FaustMonoDspGenerator).createNode(audioCtx))!
        }
        if (this.node.numberOfInputs > 0) {
            audioInputSelector.disabled = false
            updateInputDevices(await getInputDevices())
            await connectInput()
        } else {
            audioInputSelector.disabled = true
            audioInputSelector.innerHTML = "<option>Audio input</option>"
        }
        this.node.connect(audioCtx.destination)
        stopButton.disabled = false
        for (const tabButton of tabButtons) {
            tabButton.disabled = false
        }

        // Access MIDI device
        if (this.gmidi) {
            accessMIDIDevice(midiInputCallback(this.node))
                .then(() => {
                    console.log('Successfully connected to the MIDI device.');
                })
                .catch((error) => {
                    console.error('Error accessing MIDI device:', error.message);
                });
        }

        openSidebar()
        // Clear old tab contents
        for (const tab of tabContents) {
            while (tab.lastChild) tab.lastChild.remove()
        }
        // Create scope & spectrum plots
        this.analyser = new AnalyserNode(audioCtx, {
            fftSize: Math.pow(2, 11), minDecibels: -96, maxDecibels: 0, smoothingTimeConstant: 0.85
        })
        this.node.connect(this.analyser)
        this.scope = new Scope(tabContents[2])
        this.spectrum = new Scope(tabContents[3])

        // If there are UI elements, open Faust UI (controls tab); otherwise open spectrum analyzer.
        const ui = this.node.getUI()
       openTab(ui.length > 1 || ui[0].items.length > 0 ? 0 : 3)
        // openTab(3)
        // Create controls via Faust UI
        // this.node = node
        const faustUI = new FaustUI({ ui, root: faustUIRoot })
        faustUI.paramChangeByUI = (path, value) => {
            this.node?.setParamValue(path, value)
            // console.log(node, path, value)
        }
        this.node.setOutputParamHandler((path, value) => faustUI.paramChangeByDSP(path, value))

        // Create SVG block diagram
        setSVG(svgDiagrams.from("main", code, "")["process.svg"])

        // Set editor size to fit UI size
        // editorEl.style.height = `${Math.max(125, faustUI.minHeight)}px`;
        // faustUIRoot.style.width = faustUI.minWidth * 1.25 + "px"
        // faustUIRoot.style.height = faustUI.minHeight * 1.25 + "px"
    }

    connectedCallback() {
        const code = this.innerHTML.replace("&lt;", "<").replace("<!--", "").replace("-->", "").trim()
        console.log('code is!', code)
        this.attachShadow({ mode: "open" }).appendChild(template.content.cloneNode(true))
        console.log('editor style;', getComputedStyle(this), getComputedStyle(this).getPropertyValue('--main-bg-color'))

        const ideLink = this.shadowRoot!.querySelector("#ide") as HTMLAnchorElement
        ideLink.onfocus = () => {
            // Open current contents of editor in IDE
            const urlParams = new URLSearchParams()
            urlParams.set("inline", btoa(editor.state.doc.toString()).replace("+", "-").replace("/", "_"))
            ideLink.href = `https://faustide.grame.fr/?${urlParams.toString()}`
        }

        const editorEl = this.shadowRoot!.querySelector("#editor") as HTMLDivElement
        const editor = createEditor(editorEl, code)

        const runButton = this.shadowRoot!.querySelector("#run") as HTMLButtonElement
        const stopButton = this.shadowRoot!.querySelector("#stop") as HTMLButtonElement
        const faustUIRoot = this.shadowRoot!.querySelector("#faust-ui") as HTMLDivElement
        const faustDiagram = this.shadowRoot!.querySelector("#faust-diagram") as HTMLDivElement
        const sidebar = this.shadowRoot!.querySelector("#sidebar") as HTMLDivElement
        const sidebarContent = this.shadowRoot!.querySelector("#sidebar-content") as HTMLDivElement
        const tabButtons = [...this.shadowRoot!.querySelectorAll(".tab")] as HTMLButtonElement[]
        const tabContents = [...sidebarContent.querySelectorAll("div")] as HTMLDivElement[]

        const split = Split([editorEl, sidebar], {
            sizes: [100, 0],
            minSize: [0, 20],
            gutterSize: 7,
            snapOffset: 150,
            onDragEnd: () => { this.scope?.onResize(); this.spectrum?.onResize() },
        })

        faustPromise.then(() => runButton.disabled = false)

        const defaultSizes = [70, 30]
        let sidebarOpen = false
        const openSidebar = () => {
            if (!sidebarOpen) {
                split.setSizes(defaultSizes)
            }
            sidebarOpen = true
        }

        // let node: IFaustMonoWebAudioNode | undefined
        // let input: MediaStreamAudioSourceNode | undefined
        // let analyser: AnalyserNode | undefined
        // let scope: Scope | undefined
        // let spectrum: Scope | undefined
        // let gmidi = false
        // let gnvoices = -1
        // let sourceNode: AudioBufferSourceNode | undefined = undefined;

        this.gmidi = false
        this.gnvoices = -1

        runButton.onclick =  async () => { this.run() }
        
      //  async () => {
            // if (audioCtx.state === "suspended") {
            //     await audioCtx.resume()
            // }
            // await faustPromise
            // // Compile Faust code
            // const code = editor.state.doc.toString()
            // let generator = null
            // try {
            //     // Compile Faust code to access JSON metadata
            //     await default_generator.compile(compiler, "main", code, "")
            //     const json = default_generator.getMeta()
            //     console.log('compiled code', json)
            //     let event = new CustomEvent('faust-code-compiled', {
            //         bubbles: true,
            //         cancelable: true,
            //         detail: json
            //     })
            //     this.dispatchEvent(event)
            //     let { midi, nvoices } = extractMidiAndNvoices(json);
            //     gmidi = midi;
            //     gnvoices = nvoices;

            //     // Build the generator
            //     generator = nvoices > 0 ? get_poly_generator() : get_mono_generator();
            //     await generator.compile(compiler, "main", code, "-ftz 2");

            // } catch (e: any) {
            //     setError(editor, e)
            //     return
            // }
            // // Clear any old errors
            // clearError(editor)

            // // Create an audio node from compiled Faust
            // if (node !== undefined) node.disconnect()
            // if (gnvoices > 0) {
            //     node = (await (generator as FaustPolyDspGenerator).createNode(audioCtx, gnvoices))!
            // } else {
            //     node = (await (generator as FaustMonoDspGenerator).createNode(audioCtx))!
            // }
            // if (node.numberOfInputs > 0) {
            //     audioInputSelector.disabled = false
            //     updateInputDevices(await getInputDevices())
            //     await connectInput()
            // } else {
            //     audioInputSelector.disabled = true
            //     audioInputSelector.innerHTML = "<option>Audio input</option>"
            // }
            // node.connect(audioCtx.destination)
            // stopButton.disabled = false
            // for (const tabButton of tabButtons) {
            //     tabButton.disabled = false
            // }

            // // Access MIDI device
            // if (gmidi) {
            //     accessMIDIDevice(midiInputCallback(node))
            //         .then(() => {
            //             console.log('Successfully connected to the MIDI device.');
            //         })
            //         .catch((error) => {
            //             console.error('Error accessing MIDI device:', error.message);
            //         });
            // }

            // openSidebar()
            // // Clear old tab contents
            // for (const tab of tabContents) {
            //     while (tab.lastChild) tab.lastChild.remove()
            // }
            // // Create scope & spectrum plots
            // analyser = new AnalyserNode(audioCtx, {
            //     fftSize: Math.pow(2, 11), minDecibels: -96, maxDecibels: 0, smoothingTimeConstant: 0.85
            // })
            // node.connect(analyser)
            // scope = new Scope(tabContents[2])
            // spectrum = new Scope(tabContents[3])

            // // If there are UI elements, open Faust UI (controls tab); otherwise open spectrum analyzer.
            // const ui = node.getUI()
            // openTab(ui.length > 1 || ui[0].items.length > 0 ? 0 : 3)

            // // Create controls via Faust UI
            // this.node = node
            // const faustUI = new FaustUI({ ui, root: faustUIRoot })
            // faustUI.paramChangeByUI = (path, value) => {
            //     node?.setParamValue(path, value)
            //     console.log(node, path, value)
            // }
            // node.setOutputParamHandler((path, value) => faustUI.paramChangeByDSP(path, value))

            // // Create SVG block diagram
            // setSVG(svgDiagrams.from("main", code, "")["process.svg"])

            // // Set editor size to fit UI size
            // editorEl.style.height = `${Math.max(125, faustUI.minHeight)}px`;
            // faustUIRoot.style.width = faustUI.minWidth * 1.25 + "px"
            // faustUIRoot.style.height = faustUI.minHeight * 1.25 + "px"
      //  }

        const setSVG = (svgString: string) => {
            faustDiagram.innerHTML = svgString

            for (const a of faustDiagram.querySelectorAll("a")) {
                a.onclick = e => {
                    e.preventDefault()
                    const filename = (a.href as any as SVGAnimatedString).baseVal
                    const svgString = compiler.fs().readFile("main-svg/" + filename, { encoding: "utf8" }) as string
                    setSVG(svgString)
                }
            }
        }

        let animPlot: number | undefined
        const drawScope = () => {
            this.scope!.renderScope([{
                analyser: this.analyser!,
                style: "rgb(212, 100, 100)",
                edgeThreshold: 0.09,
            }])
            animPlot = requestAnimationFrame(drawScope)
        }

        const drawSpectrum = () => {
            this.spectrum!.renderSpectrum(this.analyser!)
            animPlot = requestAnimationFrame(drawSpectrum)
        }

        const openTab = (i: number) => {
            for (const [j, tab] of tabButtons.entries()) {
                if (i === j) {
                    tab.classList.add("active")
                    tabContents[j].classList.add("active")
                } else {
                    tab.classList.remove("active")
                    tabContents[j].classList.remove("active")
                }
            }
            if (i === 2) {
                this.scope!.onResize()
                if (animPlot !== undefined) cancelAnimationFrame(animPlot)
                animPlot = requestAnimationFrame(drawScope)
            } else if (i === 3) {
                this.spectrum!.onResize()
                if (animPlot !== undefined) cancelAnimationFrame(animPlot)
                animPlot = requestAnimationFrame(drawSpectrum)
            } else if (animPlot !== undefined) {
                cancelAnimationFrame(animPlot)
                animPlot = undefined
            }
        }

        for (const [i, tabButton] of tabButtons.entries()) {
            tabButton.onclick = () => openTab(i)
        }

        stopButton.onclick = () => {
            if (this.node !== undefined) {
                this.node.disconnect()
                this.node.destroy()
                this.node = undefined
                stopButton.disabled = true
                // TODO: Maybe disable controls in faust-ui tab.
            }
        }

        const audioInputSelector = this.shadowRoot!.querySelector("#audio-input") as HTMLSelectElement

        const updateInputDevices = (devices: MediaDeviceInfo[]) => {
            if (audioInputSelector.disabled) return
            while (audioInputSelector.lastChild) audioInputSelector.lastChild.remove()
            for (const device of devices) {
                if (device.kind === "audioinput") {
                    audioInputSelector.appendChild(new Option(device.label || device.deviceId, device.deviceId))
                }
            }
            audioInputSelector.appendChild(new Option("Audio File", "Audio File"))
        }
        deviceUpdateCallbacks.push(updateInputDevices)

        const connectInput = async () => {
            const deviceId = audioInputSelector.value
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
            if (this.input) {
                this.input.disconnect()
                this.input = undefined
            }
            if (this.node && this.node.numberOfInputs > 0) {
                if (deviceId == "Audio File") {
                    try {
                        // Extract the base URL (excluding the script filename)
                        const scriptTag = document.querySelector('script[src$="faust-web-component.js"]');
                        const scriptSrc = scriptTag.src;
                        const baseUrl = scriptSrc.substring(0, scriptSrc.lastIndexOf('/') + 1);
                        // Load the file
                        let file = await fetch(baseUrl + '02-XYLO1.mp3');
                        const arrayBuffer = await file.arrayBuffer();
                        let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                        // Create a source node from the buffer
                        this.sourceNode = audioCtx.createBufferSource();
                        this.sourceNode.buffer = audioBuffer;
                        this.sourceNode.connect(this.node!);
                        // Start playing the file
                        this.sourceNode.start();
                    } catch (error) {
                        console.error("Error loading file: ", error);
                    }
                } else {
                    if (this.sourceNode !== undefined) {
                        this.sourceNode.stop();
                        this.sourceNode.disconnect();
                        this.sourceNode = undefined;
                    }
                    this.input = audioCtx.createMediaStreamSource(stream);
                    this.input.connect(this.node!);
                }
            }
        }

        audioInputSelector.onchange = connectInput

        this.localElements = { setSVG, audioInputSelector, stopButton, updateInputDevices, connectInput, openTab, editor, runButton, faustUIRoot, faustDiagram, sidebar, sidebarContent, tabButtons, tabContents, split, openSidebar }

    }
}

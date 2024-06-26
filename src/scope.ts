// Based on https://codepen.io/ContemporaryInsanity/pen/Mwvqpb

export class Scope {
    container: HTMLElement
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    userStyle: { backgroundColor:string, textColor: string, graphColor: string } 
    
    constructor(container: HTMLElement) {
        console.log('CONTAINER STYLE', getComputedStyle(container).getPropertyValue('--main-bg-color'))
        this.userStyle = { backgroundColor:getComputedStyle(container).getPropertyValue('--main-bg-color'), textColor: getComputedStyle(container).getPropertyValue('--main-color'), graphColor:  getComputedStyle(container).getPropertyValue('--main-graph-color')}
        this.container = container
        this.container.classList.add("scope")
        
        this.canvas = document.createElement("canvas")
        this.canvas.style.transformOrigin = "top left"
        this.ctx = this.canvas.getContext("2d")!
        this.onResize = this.onResize.bind(this)
        
        this.container.appendChild(this.canvas)
        this.onResize()
        window.addEventListener("resize", this.onResize)
    }
    
    get canvasWidth() { return this.canvas.width / devicePixelRatio }
    set canvasWidth(canvasWidth) {
        this.canvas.width = Math.floor(canvasWidth * devicePixelRatio)
        this.canvas.style.width = `${canvasWidth}px`
    }
    
    get canvasHeight() { return this.canvas.height / devicePixelRatio }
    set canvasHeight(canvasHeight) {
        this.canvas.height = Math.floor(canvasHeight * devicePixelRatio)
        this.canvas.style.height = `${canvasHeight}px`
    }
    
    renderScope(toRender: { analyser: AnalyserNode, style: string, edgeThreshold: number }[] = []) {
        // grid
         this.ctx.fillStyle = this.userStyle.backgroundColor
        // this.ctx.fillStyle = 'yellow'
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
        this.ctx.lineWidth = 1
        this.ctx.strokeStyle =this.userStyle.graphColor
        this.ctx.fillStyle = this.userStyle.graphColor
    //    this.ctx.strokeStyle =this.userStyle.textColor
    //     this.ctx.fillStyle = this.userStyle.textColor
        this.ctx.beginPath()
        
        const numHorzSteps = 8
        const horzStep = this.canvasWidth / numHorzSteps
        for (let i = horzStep; i < this.canvasWidth; i += horzStep) {
            this.ctx.moveTo(i, 0)
            this.ctx.lineTo(i, this.canvasHeight)
        }
        
        const numVertSteps = 4
        const vertStep = this.canvasHeight / numVertSteps
        for (let i = 0; i < this.canvasHeight; i += vertStep) {
            this.ctx.moveTo(0, i)
            this.ctx.lineTo(this.canvasWidth, i)
        }
        this.ctx.stroke()
        
        // 0 line
        this.ctx.strokeStyle = "rgba(100, 100, 100, 0.5)"
        this.ctx.beginPath()
        this.ctx.lineWidth = 2
        this.ctx.moveTo(0, this.canvasHeight / 2)
        this.ctx.lineTo(this.canvasWidth, this.canvasHeight / 2)
        this.ctx.stroke()
        
        // waveforms
        toRender.forEach(({ analyser, style = "rgb(43, 156, 212)", edgeThreshold = 0 }) => {
            if (analyser === undefined) { return }
            
            const timeData = new Float32Array(analyser.frequencyBinCount)
            let risingEdge = 0
            
            analyser.getFloatTimeDomainData(timeData)
            
            this.ctx.lineWidth = 2
            this.ctx.strokeStyle = style
            
            this.ctx.strokeStyle = this.userStyle.textColor
            this.ctx.beginPath()
            
            while (timeData[risingEdge] > 0 &&
                risingEdge <= this.canvasWidth &&
                risingEdge < timeData.length) {
                risingEdge++
            }
            
            if (risingEdge >= this.canvasWidth) { risingEdge = 0 }
            
            
            while (timeData[risingEdge] < edgeThreshold &&
                risingEdge <= this.canvasWidth  &&
                risingEdge< timeData.length) {
                    risingEdge++
                }
                
            if (risingEdge >= this.canvasWidth) { risingEdge = 0 }
            
            for (let x = risingEdge; x < timeData.length && x - risingEdge < this.canvasWidth; x++) {
                const y = this.canvasHeight - (((timeData[x] + 1) / 2) * this.canvasHeight)
                this.ctx.lineTo(x - risingEdge, y)
            }
            
            this.ctx.stroke()
        })
        
        // markers
        // this.ctx.fillStyle = "black"
        this.ctx.fillStyle = this.userStyle.graphColor
        this.ctx.font = "11px Courier"
        this.ctx.textAlign = "left"
        const numMarkers = 4
        const markerStep = this.canvasHeight / numMarkers
        for (let i = 0; i <= numMarkers; i++) {
            this.ctx.textBaseline =
                  i === 0          ? "top"
                : i === numMarkers ? "bottom"
                :                    "middle"

            const value = ((numMarkers - i) - (numMarkers / 2)) / numMarkers * 2
            this.ctx.textAlign = "left"
            this.ctx.fillText(value + "", 5, i * markerStep)
            this.ctx.textAlign = "right"
            this.ctx.fillText(value + "", this.canvasWidth - 5, i * markerStep)
        }
    }
    
    renderSpectrum(analyser: AnalyserNode) {
        const freqData = new Uint8Array(analyser.frequencyBinCount)
        
        analyser.getByteFrequencyData(freqData)
        
        this.ctx.fillStyle = this.userStyle.backgroundColor
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
        
        this.ctx.lineWidth = 2
        // this.ctx.strokeStyle = "rgb(43, 156, 212)"
        this.ctx.strokeStyle = this.userStyle.textColor
        this.ctx.beginPath()
        
        for (let i = 0; i < freqData.length; i++) {
            const x = (Math.log(i / 1)) / (Math.log(freqData.length / 1)) * this.canvasWidth
            const height = (freqData[i] * this.canvasHeight) / 256
            this.ctx.lineTo(x, this.canvasHeight - height)
        }
        this.ctx.stroke()
        
        const fontSize = 12
        
        // frequencies
        function explin(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
            inMin = Math.max(inMin, 1)
            outMin = Math.max(outMin, 1)
            return Math.log10(value / inMin) / Math.log10(inMax / inMin) * (outMax - outMin) + outMin
        }
        
        const nyquist = analyser.context.sampleRate / 2;
        [0, 100, 300, 1000, 3000, 10000, 20000].forEach(freq => {
            const minFreq = 20
            const x = freq <= 0
            ? fontSize - 5
            : explin(freq, minFreq, nyquist, 0, this.canvasWidth)
            
            // this.ctx.fillStyle = "black"
            this.ctx.fillStyle = this.userStyle.graphColor
            this.ctx.textBaseline = "middle"
            this.ctx.textAlign = "right"
            this.ctx.font = `${fontSize}px Courier`
            this.ctx.save()
            this.ctx.translate(x, this.canvasHeight - 5)
            this.ctx.rotate(Math.PI * 0.5)
            this.ctx.fillText(`${freq.toFixed(0)}hz`, 0, 0)
            this.ctx.restore()
        });
        
        [0, -3, -6, -12].forEach(db => {
            const x = 5
            const amp = Math.pow(10, db * 0.05)
            const y = (1 - amp) * this.canvasHeight
            // 
            // this.ctx.fillStyle = "black"
            this.ctx.fillStyle = this.userStyle.graphColor
            this.ctx.textBaseline = "top"
            this.ctx.textAlign = "left"
            this.ctx.font = `${fontSize}px Courier`
            this.ctx.fillText(`${db.toFixed(0)}db`, x, y)
        })
    }
    
    onResize() {
        this.canvasWidth = 0
        this.canvasHeight = 0
        
        const rect = this.container.getBoundingClientRect()
        const style = getComputedStyle(this.container)
        
        let borderLeft = style.getPropertyValue("border-left-width")
        let left = borderLeft === "" ? 0 : parseFloat(borderLeft)
        let borderRight = style.getPropertyValue("border-right-width")
        let right = borderRight === "" ? 0 : parseFloat(borderRight)
        this.canvasWidth = rect.width - left - right
        
        let borderTop = style.getPropertyValue("border-top-width")
        let top = borderTop === "" ? 0 : parseFloat(borderTop)
        let borderBottom = style.getPropertyValue("border-bottom-width")
        let bottom = borderBottom === "" ? 0 : parseFloat(borderBottom)
        this.canvasHeight = rect.height - top - bottom
        
        this.ctx.scale(devicePixelRatio, devicePixelRatio)
    }
}

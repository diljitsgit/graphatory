import { useEffect, useRef, useState } from "react";
import "./App.css";
import {
    Canvas,
    Circle,
    controlsUtils,
    Group,
    InteractiveFabricObject,
    Path,
    Point,
    Rect,
    Textbox,
    TPointerEvent,
    TPointerEventInfo,
} from "fabric";
import TitleCard, { LogoAndTitle, UndoRedo } from "./TitleCard";
import ToolBar, { ToolIcon } from "./Toolbar";
import {
    MousePointer2,
    MoveUpRight,
    Shapes,
    Type,
    Workflow,
} from "lucide-react";
import SettingBox from "./settingBox";
import { FabricObject } from "fabric";
import addNode from "./Node";

declare module "fabric" {
    interface FabricObject {
        id?: string;
        name?: string;
    }
    interface SerializedObjectProps {
        id?: string;
        name?: string;
    }
}

FabricObject.customProperties = ["name", "id"];

function App() {
    const canvasRef = useRef(null);
    const [canvas, setCanvas] = useState<Canvas | null>(null);
    const [guidePoints, setGuidePoints] = useState<Point[]>([]);

    window.addEventListener("resize", () => {
        if (canvas) {
            //The following logic is correct but gives a error needs to be debugged
            // canvas.setDimensions({
            //     width: window.innerWidth,
            //     height: window.innerHeight,
            // });
            //The following logic is depreciated needs to be changed
            // canvas.setWidth(window.innerWidth);
            // canvas.setHeight(window.innerHeight);
        }
    });

    function backgroundGrid() {
        const circles = [];
        const offset = 5;
        const spacing = 17;
        for (let i = offset; i < window.outerWidth; i += spacing) {
            for (let j = offset; j < window.outerHeight; j += spacing) {
                const circle = new Circle({
                    top: j,
                    left: i,
                    radius: 1,
                    fill: "gray",
                    opacity: 0.5,
                });
                circles.push(circle);
            }
        }
        return new Group(circles, {
            selectable: false,
            interactive: false,
            lockMovementX: true,
            lockMovementY: true,
            evented: false,
            name: "dot-matrix-background",
        });
    }

    useEffect(() => {
        if (canvasRef.current) {
            const initCanvas = new Canvas(canvasRef.current, {
                width: window.innerWidth,
                height: window.innerHeight,
            });

            initCanvas.backgroundColor = "#efefef";
            initCanvas.renderAll();

            setCanvas(initCanvas);
            initCanvas.add(backgroundGrid());

            return () => {
                initCanvas.dispose();
            };
        }
    }, []);

    InteractiveFabricObject.ownDefaults = {
        ...InteractiveFabricObject.ownDefaults,
        cornerStyle: "circle",
        cornerStrokeColor: "black",
        cornerColor: "white",
        transparentCorners: false,
        borderColor: "black",
        borderScaleFactor: 2,
        padding: 10,
    };

    function addLine() {
        let drawing = false;
        let Line: Path;
        let startPoint = new Point();

        refillGuidlines();

        function refillGuidlines() {
            if (canvas) {
                setGuidePoints([]);
                canvas.getObjects().forEach((obj) => {
                    if (obj.type != "path") {
                        const coords = obj.aCoords;
                        const p1 = new Point({
                            x: (coords.tl.x + coords.tr.x) / 2,
                            y: coords.tl.y,
                        });
                        const p2 = new Point({
                            x: (coords.tl.x + coords.tr.x) / 2,
                            y: coords.bl.y,
                        });
                        const p3 = new Point({
                            x: coords.bl.x,
                            y: (coords.tl.y + coords.br.y) / 2,
                        });
                        const p4 = new Point({
                            x: coords.br.x,
                            y: (coords.tl.y + coords.br.y) / 2,
                        });

                        setGuidePoints((prev) => [...prev, p1, p2, p3, p4]);
                    }
                });
            }
        }

        if (canvas) {
            canvas.getObjects().forEach((a) => {
                a.set({ selectable: false });
            });

            canvas.on("mouse:down", startDrawing);
            canvas.on("mouse:move", modifyDrawing);
            canvas.on("mouse:up", stopDrawing);
        }

        function snap(point: Point) {
            let ret = point;
            guidePoints.forEach((p) => {
                if (close(p, point)) {
                    ret = p;
                }
            });
            return ret;
        }

        function close(p: Point, point: Point) {
            const tolerence = 15;
            if (point.x <= p.x + tolerence && point.x >= p.x - tolerence) {
                if (point.y <= p.y + tolerence && point.y >= p.y - tolerence) {
                    return true;
                }
            }
            return false;
        }

        function deactivate() {
            if (canvas) {
                canvas.off("mouse:down", startDrawing);
                canvas.off("mouse:move", modifyDrawing);
                canvas.off("mouse:up", stopDrawing);
            }
        }

        function startDrawing(event: TPointerEventInfo<TPointerEvent>) {
            if (canvas) {
                if (!drawing) {
                    const pointer = snap(canvas.getViewportPoint(event.e));
                    startPoint = pointer;
                    Line = new Path(getPath(pointer, pointer), {
                        id: "added-line",
                        fill: null,
                        strokeWidth: 2,
                        stroke: "black",
                    });

                    canvas.add(Line);
                    drawing = true;
                }
            }
        }

        function modifyDrawing(event: TPointerEventInfo<TPointerEvent>) {
            if (canvas) {
                if (drawing) {
                    canvas.selection = false;
                    const pointer = snap(canvas.getViewportPoint(event.e));
                    canvas.remove(Line);
                    Line = new Path(getPath(startPoint, pointer), {
                        fill: null,
                        strokeWidth: 3,
                        stroke: "black",
                    });
                    canvas.add(Line);
                    canvas.renderAll();
                }
            }
        }

        function stopDrawing(event: TPointerEventInfo<TPointerEvent>) {
            if (canvas) {
                const pointer = canvas.getViewportPoint(event.e);
                if (!close(startPoint, pointer)) {
                    canvas.selection = true;
                    drawing = false;
                    canvas.getObjects().forEach((a) => {
                        if (a.name != "dot-matrix-background") {
                            a.set({ selectable: true });
                        }
                    });
                    deactivate();
                    Line.on("mousedown", () => {
                        Line.cornerStyle = "circle";
                        Line.hasBorders = false;
                        Line.controls = controlsUtils.createPathControls(Line);
                    });
                }
            }
        }

        function getPath(startpointer: Point, endpointer: Point) {
            const xheavy =
                Math.abs(endpointer.x - startPoint.x) >
                Math.abs(endpointer.y - startPoint.y);
            if (xheavy) {
                return (
                    "M " +
                    startpointer.x +
                    " " +
                    startpointer.y +
                    " C " +
                    (startpointer.x + endpointer.x) / 2 +
                    " " +
                    startpointer.y +
                    " " +
                    (startpointer.x + endpointer.x) / 2 +
                    " " +
                    endpointer.y +
                    " " +
                    endpointer.x +
                    " " +
                    endpointer.y
                );
            }
            return (
                "M " +
                startpointer.x +
                " " +
                startpointer.y +
                " C " +
                startpointer.x +
                " " +
                (startpointer.y + endpointer.y) / 2 +
                " " +
                endpointer.x +
                " " +
                (startpointer.y + endpointer.y) / 2 +
                " " +
                endpointer.x +
                " " +
                endpointer.y
            );
        }
    }

    function addText() {
        if (canvas) {
            const nodeWidth = 180;
            const nodeHeight = 50;
            const defaultAccentWidth = 15;
            const defaultTextSize = 16;
            const padding = 5;

            const text = new Textbox("Node1", {
                left: 425,
                top: 300,
                textAlign: "center",
                fontSize: defaultTextSize,
                lockScalingY: true,
                fill: "#3D3D3D",
                width: nodeWidth - defaultAccentWidth - 2 * padding,
                height: nodeHeight - 2 * padding,
                fontFamily: "REM",
            });

            text.on("scaling", () => {
                text.set({
                    fontSize: defaultTextSize / text.scaleX,
                    top: nodeHeight / 2 / text.scaleY / defaultTextSize,
                });
            });

            canvas.add(text);
        }
    }

    function addShapes() {
        if (canvas) {
            const rect = new Rect({
                width: 360,
                height: 120,
                fill: null,
                stroke: "black",
                strokeWidth: 3,
                rx: 10,
            });
            canvas.centerObject(rect);
            canvas.add(rect);
        }
    }

    return (
        <>
            <canvas ref={canvasRef}></canvas>
            <SettingBox canvas={canvas}></SettingBox>
            <TitleCard>
                <LogoAndTitle></LogoAndTitle>
                <UndoRedo></UndoRedo>
            </TitleCard>
            <ToolBar>
                <ToolIcon tooltip="select">
                    <MousePointer2 color="#000" size={20} strokeWidth={1.5} />
                </ToolIcon>
                <ToolIcon
                    tooltip="add Node"
                    onClick={() => {
                        addNode(canvas);
                    }}
                >
                    <Workflow color="#000" size={20} strokeWidth={1.5} />
                </ToolIcon>
                <ToolIcon tooltip="add shapes" onClick={addShapes}>
                    <Shapes color="#000" size={20} strokeWidth={1.5} />
                </ToolIcon>
                <ToolIcon tooltip="add line" onClick={addLine}>
                    <MoveUpRight color="#000" size={20} strokeWidth={1.5} />
                </ToolIcon>
                <ToolIcon tooltip="add text" onClick={addText}>
                    <Type color="#000" size={20} strokeWidth={1.5} />
                </ToolIcon>
                {/* <ToolIcon tooltip="add custom objects" onClick={test}>
                    <Plus color="#000" size={20} strokeWidth={1.5} />
                </ToolIcon> */}
            </ToolBar>
        </>
    );
}

export default App;

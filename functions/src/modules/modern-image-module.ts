import type PizZip from "pizzip";
import { DOMParser } from "@xmldom/xmldom";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const docxtemplaterNamespace = require("docxtemplater");
const { DocUtils } = docxtemplaterNamespace;

const MODULE_NAME = "quorumflow/docxtemplater-modern-image-module";
const DEFAULT_IMAGE_EXTENSION = "png";

interface ModernImageModuleOptions {
    centered?: boolean;
    getImage: (tagValue: unknown, tagName: string) => Buffer | Promise<Buffer>;
    getSize: (
        image: Buffer,
        tagValue: unknown,
        tagName: string
    ) => [number, number] | Promise<[number, number]>;
}

interface ModulePart {
    module: string;
    type: string;
    value: string;
    centered?: boolean;
}

interface ScopeManager {
    getValue: (key: string, context: { part: ModulePart }) => unknown;
}

interface RenderOptions {
    scopeManager: ScopeManager;
    filePath: string;
}

interface ResolverOptions extends RenderOptions {}

class RelationshipManager {
    private readonly relsPath: string;
    private readonly relationshipsDocument: any;

    constructor(
        private readonly zip: PizZip,
        filePath: string,
        private readonly xmlDocuments: Record<string, any>
    ) {
        this.relsPath = this.computeRelsPath(filePath);
        this.relationshipsDocument = this.ensureRelationshipsDocument();
    }

    addImage(name: string, data: Buffer): number {
        const uniqueName = this.ensureUniqueName(name);
        const mediaPath = `word/media/${uniqueName}`;

        this.zip.file(mediaPath, data, { binary: true });

        const extension = this.getExtension(uniqueName);
        this.ensureContentType(extension);

        const nextRid = this.getNextRelationshipId();
        this.appendRelationshipNode(nextRid, uniqueName);

        return nextRid;
    }

    private ensureRelationshipsDocument(): any {
        const existing = this.xmlDocuments[this.relsPath];
        if (existing) {
            return existing;
        }

        const templatePath = "word/_rels/document.xml.rels";
        const template = this.xmlDocuments[templatePath];
        if (!template) {
            throw new Error(
                `Unable to bootstrap relationships XML. Missing template at ${templatePath}.`
            );
        }

        const cloned = new DOMParser().parseFromString(
            DocUtils.xml2str(template),
            "application/xml"
        );
        const relationships = cloned.getElementsByTagName("Relationships")[0];
        const relationshipNodes = relationships.getElementsByTagName("Relationship");

        for (let index = relationshipNodes.length - 1; index >= 0; index -= 1) {
            const node = relationshipNodes.item(index);
            if (node) {
                relationships.removeChild(node);
            }
        }

        this.xmlDocuments[this.relsPath] = cloned;
        return cloned;
    }

    private computeRelsPath(filePath: string): string {
        const lastSlash = filePath.lastIndexOf("/");
        const directory = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
        const fileName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
        return `${directory}/_rels/${fileName}.rels`;
    }

    private ensureUniqueName(original: string): string {
        let attempt = original;
        let counter = 1;
        while (this.zip.file(`word/media/${attempt}`)) {
            const suffix = `(${counter})`;
            const dotIndex = original.lastIndexOf(".");
            if (dotIndex === -1) {
                attempt = `${original}${suffix}`;
            } else {
                attempt = `${original.slice(0, dotIndex)}${suffix}${original.slice(dotIndex)}`;
            }
            counter += 1;
        }
        return attempt;
    }

    private ensureContentType(extension: string): void {
        const normalizedExtension = extension.toLowerCase();
        const contentTypesDocument = this.xmlDocuments["[Content_Types].xml"];
        if (!contentTypesDocument) {
            throw new Error("Unable to resolve [Content_Types].xml document.");
        }

        const defaults = contentTypesDocument.getElementsByTagName("Default");
        const isRegistered = Array.from({ length: defaults.length }).some((_, index) => {
            const node = defaults.item(index);
            return node?.getAttribute("Extension")?.toLowerCase() === normalizedExtension;
        });

        if (isRegistered) {
            return;
        }

        const typesNode = contentTypesDocument.getElementsByTagName("Types")[0];
        const newDefault = contentTypesDocument.createElement("Default");
        newDefault.setAttribute("Extension", normalizedExtension);
        newDefault.setAttribute("ContentType", `image/${normalizedExtension}`);
        typesNode.appendChild(newDefault);
    }

    private getNextRelationshipId(): number {
        const relationships = this.relationshipsDocument.getElementsByTagName("Relationship");
        let highest = 0;
        for (let index = 0; index < relationships.length; index += 1) {
            const node = relationships.item(index);
            const idValue = node?.getAttribute("Id");
            if (idValue && /^rId\d+$/.test(idValue)) {
                const numeric = Number.parseInt(idValue.slice(3), 10);
                highest = Math.max(highest, numeric);
            }
        }
        return highest + 1;
    }

    private appendRelationshipNode(rId: number, imageName: string): void {
        const relationshipsNode = this.relationshipsDocument.getElementsByTagName("Relationships")[0];
        const relationshipNode = this.relationshipsDocument.createElement("Relationship");
        relationshipNode.setAttribute("Id", `rId${rId}`);
        relationshipNode.setAttribute(
            "Type",
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
        );
        relationshipNode.setAttribute("Target", `media/${imageName}`);
        relationshipsNode.appendChild(relationshipNode);
    }

    private getExtension(fileName: string): string {
        const match = /\.([a-zA-Z0-9]{2,5})(?:$|[?#])/.exec(fileName);
        return match ? match[1].toLowerCase() : DEFAULT_IMAGE_EXTENSION;
    }
}

export default class ModernImageModule {
    name = "ModernImageModule";

    private readonly options: Required<ModernImageModuleOptions>;
    private imageNumber = 1;
    private zip: PizZip | null = null;
    private xmlDocuments: Record<string, any> | null = null;
    private fileTypeConfig: { tagTextXml: string } | null = null;

    constructor(options: ModernImageModuleOptions) {
        if (!options.getImage) {
            throw new Error("ModernImageModule requires a getImage implementation.");
        }
        if (!options.getSize) {
            throw new Error("ModernImageModule requires a getSize implementation.");
        }

        this.options = {
            centered: options.centered ?? false,
            getImage: options.getImage,
            getSize: options.getSize,
        };
    }

    optionsTransformer(options: any, docxtemplater?: any) {
        if (!docxtemplater) {
            return options;
        }

        const rels = docxtemplater.zip
            .file(/\.xml\.rels/)
            .map((file: { name: string }) => file.name);
        const contentTypes = docxtemplater.zip
            .file(/\[Content_Types\].xml/)
            .map((file: { name: string }) => file.name);

        const existingNames: string[] = Array.isArray(options.xmlFileNames)
            ? options.xmlFileNames
            : [];
        const names = new Set<string>(existingNames);
        rels.concat(contentTypes).forEach((name: string) => names.add(name));

        this.zip = docxtemplater.zip;
        this.fileTypeConfig = docxtemplater.fileTypeConfig;
        options.xmlFileNames = Array.from(names);
        return options;
    }

    set(options: { zip?: PizZip; xmlDocuments?: Record<string, any> }) {
        if (options.zip) {
            this.zip = options.zip;
        }
        if (options.xmlDocuments) {
            this.xmlDocuments = options.xmlDocuments;
        }
    }

    parse(placeHolderContent: string): ModulePart | null {
        if (placeHolderContent.startsWith("%%")) {
            return {
                module: MODULE_NAME,
                type: "placeholder",
                value: placeHolderContent.slice(2),
                centered: true,
            };
        }
        if (placeHolderContent.startsWith("%")) {
            return {
                module: MODULE_NAME,
                type: "placeholder",
                value: placeHolderContent.slice(1),
                centered: false,
            };
        }
        return null;
    }

    postparse(parsed: unknown) {
        return DocUtils.traits.expandToOne(parsed, {
            moduleName: MODULE_NAME,
            expandTo: this.options.centered ? "w:p" : "w:t",
            getInner: ({ part }: { part: unknown }) => part,
        });
    }

    render(part: ModulePart, options?: RenderOptions) {
        if (part.module !== MODULE_NAME) {
            return null;
        }

        if (!options) {
            throw new Error("ModernImageModule requires render options to resolve scope and file information.");
        }

        const value = options.scopeManager.getValue(part.value, { part });
        if (!value) {
            return this.toRendered(this.getFallbackTag());
        }

        const buffer = this.resolveBufferSync(this.options.getImage(value, part.value));
        if (buffer.length === 0) {
            return this.toRendered(this.getFallbackTag());
        }

        const size = this.resolveSizeSync(this.options.getSize(buffer, value, part.value));
        const manager = this.createRelationshipManager(options.filePath);
        const rId = manager.addImage(this.createImageName(value), buffer);
        const xml = this.renderImageXml(part.centered ?? this.options.centered, rId, size);
        return this.toRendered(xml);
    }

    resolve(part: ModulePart, options?: ResolverOptions) {
        if (part.module !== MODULE_NAME) {
            return null;
        }

        if (!options) {
            throw new Error("ModernImageModule requires resolver options to access scope data.");
        }

        const value = options.scopeManager.getValue(part.value, { part });
        if (!value) {
            return Promise.resolve(this.toRendered(this.getFallbackTag()));
        }

        const manager = this.createRelationshipManager(options.filePath);
        return Promise.resolve(this.options.getImage(value, part.value))
            .then((image) => this.ensureBuffer(image))
            .then((buffer) => {
                if (buffer.length === 0) {
                    return this.toRendered(this.getFallbackTag());
                }
                return Promise.resolve(this.options.getSize(buffer, value, part.value)).then((size) => {
                    const rId = manager.addImage(this.createImageName(value), buffer);
                    const xml = this.renderImageXml(
                        part.centered ?? this.options.centered,
                        rId,
                        this.normalizeSize(size)
                    );
                    return this.toRendered(xml);
                });
            });
    }

    private createRelationshipManager(filePath: string): RelationshipManager {
        if (!this.zip || !this.xmlDocuments) {
            throw new Error("ModernImageModule has not been initialised with document context.");
        }
        return new RelationshipManager(this.zip, filePath, this.xmlDocuments);
    }

    private resolveBufferSync(result: Buffer | Promise<Buffer>): Buffer {
        if (result instanceof Promise) {
            throw new Error(
                "Asynchronous image sources are not supported in synchronous render path. Use async templates instead."
            );
        }
        return this.ensureBuffer(result);
    }

    private resolveSizeSync(result: [number, number] | Promise<[number, number]>): [number, number] {
        if (result instanceof Promise) {
            throw new Error(
                "Asynchronous size resolvers are not supported in synchronous render path. Use async templates instead."
            );
        }
        return this.normalizeSize(result);
    }

    private ensureBuffer(value: Buffer): Buffer {
        if (!Buffer.isBuffer(value)) {
            throw new Error("ModernImageModule expected getImage to resolve to a Buffer instance.");
        }
        return value;
    }

    private normalizeSize(value: [number, number]): [number, number] {
        const [width, height] = value;
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            throw new Error("ModernImageModule expected getSize to resolve to positive numeric dimensions.");
        }
        return [width, height];
    }

    private renderImageXml(centered: boolean, rId: number, sizeInPixels: [number, number]): string {
        const [width, height] = sizeInPixels.map((dimension) =>
            DocUtils.convertPixelsToEmus(dimension)
        ) as [string, string];
        if (centered) {
            return this.getCenteredXml(rId, width, height);
        }
        return this.getInlineXml(rId, width, height);
    }

    private getInlineXml(rId: number, width: string, height: string): string {
        return `
            <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                    <wp:extent cx="${width}" cy="${height}"/>
                    <wp:effectExtent l="0" t="0" r="0" b="0"/>
                    <wp:docPr id="${rId}" name="Generated Image" descr="embedded image"/>
                    <wp:cNvGraphicFramePr>
                        <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
                    </wp:cNvGraphicFramePr>
                    <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
                        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                            <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                                <pic:nvPicPr>
                                    <pic:cNvPr id="${rId}" name="Generated Image"/>
                                    <pic:cNvPicPr>
                                        <a:picLocks noChangeAspect="1" noChangeArrowheads="1"/>
                                    </pic:cNvPicPr>
                                </pic:nvPicPr>
                                <pic:blipFill>
                                    <a:blip r:embed="rId${rId}"/>
                                    <a:stretch>
                                        <a:fillRect/>
                                    </a:stretch>
                                </pic:blipFill>
                                <pic:spPr bwMode="auto">
                                    <a:xfrm>
                                        <a:off x="0" y="0"/>
                                        <a:ext cx="${width}" cy="${height}"/>
                                    </a:xfrm>
                                    <a:prstGeom prst="rect">
                                        <a:avLst/>
                                    </a:prstGeom>
                                </pic:spPr>
                            </pic:pic>
                        </a:graphicData>
                    </a:graphic>
                </wp:inline>
            </w:drawing>
        `.replace(/\s{2,}/g, "");
    }

    private getCenteredXml(rId: number, width: string, height: string): string {
        return `
            <w:p>
                <w:pPr>
                    <w:jc w:val="center"/>
                </w:pPr>
                <w:r>
                    <w:rPr/>
                    ${this.getInlineXml(rId, width, height)}
                </w:r>
            </w:p>
        `.replace(/\s{2,}/g, "");
    }

    private createImageName(tagValue: unknown): string {
        const extension = this.resolveExtension(tagValue);
        const name = `report-image-${this.imageNumber}.${extension}`;
        this.imageNumber += 1;
        return name;
    }

    private resolveExtension(tagValue: unknown): string {
        if (typeof tagValue === "string") {
            const match = /\.([a-zA-Z0-9]{2,5})(?:$|[?#])/.exec(tagValue);
            if (match) {
                return match[1].toLowerCase();
            }
        }
        return DEFAULT_IMAGE_EXTENSION;
    }

    private toRendered(value: string) {
        return { value, errors: [] as any[] };
    }

    private getFallbackTag(): string {
        if (!this.fileTypeConfig) {
            throw new Error("ModernImageModule does not have access to file type configuration.");
        }
        return this.fileTypeConfig.tagTextXml;
    }
}

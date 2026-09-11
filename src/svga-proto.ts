export const svgaSchema = `
syntax = "proto2";
package com.opensource.svga;

message MovieParams {
    optional float viewBoxWidth = 1;
    optional float viewBoxHeight = 2;
    optional int32 fps = 3;
    optional int32 frames = 4;
}

message SpriteEntity {
    optional string imageKey = 1;
    repeated FrameEntity frames = 2;
    optional string matteKey = 3;
    optional string blendMode = 4;
}

message AudioEntity {
    optional string audioKey = 1;
    optional int32 startFrame = 2;
    optional int32 endFrame = 3;
    optional int32 startTime = 4;
    optional int32 totalTime = 5;
}

message Layout {
    optional float x = 1;
    optional float y = 2;
    optional float width = 3;
    optional float height = 4;
}

message Transform {
    optional float a = 1;
    optional float b = 2;
    optional float c = 3;
    optional float d = 4;
    optional float tx = 5;
    optional float ty = 6;
}

message ShapeEntity {
    enum ShapeType {
        SHAPE = 0;
        RECT = 1;
        ELLIPSE = 2;
        KEEP = 3;
    }
    message ShapeArgs {
        optional string d = 1;
    }
    message RectArgs {
        optional float x = 1;
        optional float y = 2;
        optional float width = 3;
        optional float height = 4;
        optional float cornerRadius = 5;
    }
    message EllipseArgs {
        optional float x = 1;
        optional float y = 2;
        optional float radiusX = 3;
        optional float radiusY = 4;
    }
    optional ShapeType type = 1;
    optional ShapeArgs shape = 2;
    optional RectArgs rect = 3;
    optional EllipseArgs ellipse = 4;
    optional ShapeStyle styles = 10;
    optional Transform transform = 11;
}

message ShapeStyle {
    message RGBAColor {
        optional float r = 1;
        optional float g = 2;
        optional float b = 3;
        optional float a = 4;
    }
    optional RGBAColor fill = 1;
    optional RGBAColor stroke = 2;
    optional float strokeWidth = 3;
    optional string lineCap = 4;
    optional string lineJoin = 5;
    optional float miterLimit = 6;
    optional float lineDashI = 7;
    optional float lineDashII = 8;
    optional float lineDashIII = 9;
}

message FrameEntity {
    optional float alpha = 1;
    optional Layout layout = 2;
    optional Transform transform = 3;
    optional string clipPath = 4;
    repeated ShapeEntity shapes = 5;
    optional string blendMode = 6;
}

message MovieEntity {
    optional string version = 1;
    optional MovieParams params = 2;
    map<string, bytes> images = 3;
    repeated SpriteEntity sprites = 4;
    repeated AudioEntity audios = 5;
}
`;


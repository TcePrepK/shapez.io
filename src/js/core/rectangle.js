import { globalConfig } from "./config";
import { epsilonCompare, round2Digits } from "./utils";
import { Vector } from "./vector";

export class Rectangle {
    constructor(x = 0, y = 0, w = 0, h = 0) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;

        this.lt = new Vector(x, y);
        this.rt = new Vector(x + w, y);
        this.lb = new Vector(x, y + h);
        this.rb = new Vector(x + w, y + h);
    }

    /**
     * @param {Vector} lt
     * @param {Vector} rt
     * @param {Vector} rb
     * @param {Vector} lb
     */
    setCorners(lt, rt, rb, lb) {
        this.lt = lt;
        this.rt = rt;
        this.rb = rb;
        this.lb = lb;

        this.x = lt.x;
        this.y = lt.y;

        this.w = Math.abs(lt.sub(rt).length());
        this.h = Math.abs(rt.sub(rb).length());
    }

    /**
     * Creates a rectangle from top right bottom and left offsets
     * @param {number} top
     * @param {number} right
     * @param {number} bottom
     * @param {number} left
     */
    static fromTRBL(top, right, bottom, left) {
        return new Rectangle(left, top, right - left, bottom - top);
    }

    /**
     * Constructs a new square rectangle
     * @param {number} x
     * @param {number} y
     * @param {number} size
     */
    static fromSquare(x, y, size) {
        return new Rectangle(x, y, size, size);
    }

    /**
     *
     * @param {Vector} p1
     * @param {Vector} p2
     */
    static fromTwoPoints(p1, p2) {
        const left = Math.min(p1.x, p2.x);
        const top = Math.min(p1.y, p2.y);
        const right = Math.max(p1.x, p2.x);
        const bottom = Math.max(p1.y, p2.y);
        return new Rectangle(left, top, right - left, bottom - top);
    }

    /**
     * Returns if a intersects b
     * @param {Rectangle} a
     * @param {Rectangle} b
     */
    static intersects(a, b) {
        return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
    }

    /**
     * Copies this instance
     * @returns {Rectangle}
     */
    clone() {
        return new Rectangle(this.x, this.y, this.w, this.h);
    }

    /**
     * Returns if this rectangle is empty
     * @returns {boolean}
     */
    isEmpty() {
        return epsilonCompare(this.w * this.h, 0);
    }

    /**
     * Returns if this rectangle is equal to the other while taking an epsilon into account
     * @param {Rectangle} other
     * @param {number} epsilon
     */
    equalsEpsilon(other, epsilon) {
        return (
            epsilonCompare(this.lt.x, other.lt.x, epsilon) &&
            epsilonCompare(this.rt.x, other.rt.x, epsilon) &&
            epsilonCompare(this.rb.x, other.rb.x, epsilon) &&
            epsilonCompare(this.lb.x, other.lb.x, epsilon) &&
            epsilonCompare(this.lt.y, other.lt.y, epsilon) &&
            epsilonCompare(this.rt.y, other.rt.y, epsilon) &&
            epsilonCompare(this.rb.y, other.rb.y, epsilon) &&
            epsilonCompare(this.lb.y, other.lb.y, epsilon)
        );
    }

    /**
     * @returns {number}
     */
    left() {
        const values = [this.lt.x, this.rt.x, this.rb.x, this.lb.x].sort((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });
        return values[0];
    }

    /**
     * @returns {number}
     */
    right() {
        const values = [this.lt.x, this.rt.x, this.rb.x, this.lb.x].sort((a, b) => {
            if (a < b) return 1;
            if (a > b) return -1;
            return 0;
        });
        return values[0];
    }

    /**
     * @returns {number}
     */
    top() {
        const values = [this.lt.y, this.rt.y, this.rb.y, this.lb.y].sort((a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });
        return values[0];
    }

    /**
     * @returns {number}
     */
    bottom() {
        const values = [this.lt.y, this.rt.y, this.rb.y, this.lb.y].sort((a, b) => {
            if (a < b) return 1;
            if (a > b) return -1;
            return 0;
        });
        return values[0];
    }

    /**
     * Returns Top, Right, Bottom, Left
     * @returns {[number, number, number, number]}
     */
    trbl() {
        return [this.top(), this.right(), this.bottom(), this.bottom()];
    }

    /**
     * Returns the center of the rect
     * @returns {Vector}
     */
    getCenter() {
        const x = (this.left() + this.right()) / 2;
        const y = (this.top() + this.bottom()) / 2;
        return new Vector(x, y);
    }

    /**
     * Returns new rotated rectangle
     * @param {number} angle
     * @returns {Rectangle}
     */
    rotate(angle) {
        // if (angle % 90 != 0) {
        //     this.rotated = true;
        // } else {
        //     this.rotated = false;
        // }

        const rotate_point = (pointX, pointY, originX, originY, angle) => {
            angle = (angle * Math.PI) / 180;
            return new Vector(
                Math.cos(angle) * (pointX - originX) - Math.sin(angle) * (pointY - originY) + originX,
                Math.sin(angle) * (pointX - originX) + Math.cos(angle) * (pointY - originY) + originY
            );
        };

        // const origin = this.getCenter();
        const origin = globalConfig.root.camera.center;
        const p1 = this.lt;
        const p2 = this.rt;
        const p3 = this.rb;
        const p4 = this.lb;

        const rp1 = rotate_point(p1.x, p1.y, origin.x, origin.y, angle).round();
        const rp2 = rotate_point(p2.x, p2.y, origin.x, origin.y, angle).round();
        const rp3 = rotate_point(p3.x, p3.y, origin.x, origin.y, angle).round();
        const rp4 = rotate_point(p4.x, p4.y, origin.x, origin.y, angle).round();

        const newRectangle = new Rectangle();
        newRectangle.setCorners(rp1, rp2, rp3, rp4);

        const rect = this;
        const parameters = globalConfig.parameters;
        parameters.context.strokeStyle = "green";
        parameters.context.beginPath();
        parameters.context.moveTo(rect.lt.x, rect.lt.y);
        parameters.context.lineTo(rect.rt.x, rect.rt.y);
        parameters.context.lineTo(rect.rb.x, rect.rb.y);
        parameters.context.lineTo(rect.lb.x, rect.lb.y);
        parameters.context.stroke();

        console.log(this);

        return newRectangle;
    }

    /**
     * Sets the right side of the rect without moving it
     * @param {number} right
     */
    setRight(right) {
        this.w = right - this.x;
    }

    /**
     * Sets the bottom side of the rect without moving it
     * @param {number} bottom
     */
    setBottom(bottom) {
        this.h = bottom - this.y;
    }

    /**
     * Sets the top side of the rect without scaling it
     * @param {number} top
     */
    setTop(top) {
        const bottom = this.bottom();
        this.y = top;
        this.setBottom(bottom);
    }

    /**
     * Sets the left side of the rect without scaling it
     * @param {number} left
     */
    setLeft(left) {
        const right = this.right();
        this.x = left;
        this.setRight(right);
    }

    /**
     * Returns the top left point
     * @returns {Vector}
     */
    topLeft() {
        return new Vector(this.x, this.y);
    }

    /**
     * Returns the bottom left point
     * @returns {Vector}
     */
    bottomRight() {
        return new Vector(this.right(), this.bottom());
    }

    /**
     * Moves the rectangle by the given parameters
     * @param {number} x
     * @param {number} y
     */
    moveBy(x, y) {
        this.lt.x += x;
        this.rt.x += x;
        this.rb.x += x;
        this.lb.x += x;

        this.lt.y += y;
        this.rt.y += y;
        this.rb.y += y;
        this.lb.y += y;
    }

    /**
     * Moves the rectangle by the given vector
     * @param {Vector} vec
     */
    moveByVector(vec) {
        this.x += vec.x;
        this.y += vec.y;
    }

    /**
     * Scales every parameter (w, h, x, y) by the given factor. Useful to transform from world to
     * tile space and vice versa
     * @param {number} factor
     */
    allScaled(factor) {
        const center = this.getCenter();
        const lt = this.lt.multiplyScalar(factor);
        const rt = this.rt.multiplyScalar(factor);
        const rb = this.rb.multiplyScalar(factor);
        const lb = this.lb.multiplyScalar(factor);

        const rect = new Rectangle();
        rect.setCorners(lt, rt, rb, lb);
        return rect;
    }

    /**
     * Expands the rectangle in all directions
     * @param {number} amount
     * @returns {Rectangle} new rectangle
     */
    expandedInAllDirections(amount) {
        const lt = this.lt.add(this.lt.normalize().multiplyScalar(amount)).round();
        const rt = this.rt.add(this.rt.normalize().multiplyScalar(amount)).round();
        const rb = this.rb.add(this.rb.normalize().multiplyScalar(amount)).round();
        const lb = this.lb.add(this.lb.normalize().multiplyScalar(amount)).round();

        const rect = new Rectangle();
        rect.setCorners(lt, rt, rb, lb);
        return rect;
    }

    /**
     * Returns if the given rectangle is contained
     * @param {Rectangle} rect
     * @returns {boolean}
     */
    containsRect(rect) {
        // return (
        //     this.top() <= rect.top() &&
        //     this.bottom() >= rect.bottom() &&
        //     this.left() <= rect.left() &&
        //     this.right() >= rect.right()
        // );
        return (
            this.left() <= rect.right() &&
            rect.left() <= this.right() &&
            this.top() <= rect.bottom() &&
            rect.top() <= this.bottom()
        );
    }

    /**
     * Returns if this rectangle contains the other rectangle specified by the parameters
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @returns {boolean}
     */
    containsRect4Params(x, y, w, h) {
        return this.left() <= x + w && x <= this.right() && this.top() <= y + h && y <= this.bottom();
    }

    /**
     * Returns if the rectangle contains the given circle at (x, y) with the radius (radius)
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @returns {boolean}
     */
    containsCircle(x, y, radius) {
        return (
            this.left() <= x + radius &&
            x - radius <= this.right() &&
            this.top() <= y + radius &&
            y - radius <= this.bottom()
        );
    }

    /**
     * Returns if hte rectangle contains the given point
     * @param {number} x
     * @param {number} y
     * @returns {boolean}
     */
    containsPoint(x, y) {
        return x >= this.left() && x < this.right() && y >= this.top() && y < this.bottom();
    }

    /**
     * Returns the shared area with another rectangle, or null if there is no intersection
     * @param {Rectangle} rect
     * @returns {Rectangle|null}
     */
    getIntersection(rect) {
        const left = Math.max(this.left(), rect.left());
        const top = Math.max(this.top(), rect.top());

        const right = Math.min(this.right(), rect.right());
        const bottom = Math.min(this.bottom(), rect.bottom());

        if (right <= left || bottom <= top) {
            return null;
        }

        return Rectangle.fromTRBL(top, right, bottom, left);
    }

    /**
     * Returns the union of this rectangle with another
     * @param {Rectangle} rect
     */
    getUnion(rect) {
        if (this.isEmpty()) {
            // If this is rect is empty, return the other one
            return rect.clone();
        }
        if (rect.isEmpty()) {
            // If the other is empty, return this one
            return this.clone();
        }

        // Find contained area
        const left = Math.min(this.left(), rect.left());
        const top = Math.min(this.top(), rect.top());
        const right = Math.max(this.right(), rect.right());
        const bottom = Math.max(this.bottom(), rect.bottom());

        return Rectangle.fromTRBL(top, right, bottom, left);
    }

    /**
     * Good for caching stuff
     */
    toCompareableString() {
        return (
            round2Digits(this.x) +
            "/" +
            round2Digits(this.y) +
            "/" +
            round2Digits(this.w) +
            "/" +
            round2Digits(this.h)
        );
    }

    /**
     * Good for printing stuff
     */
    toString() {
        return (
            "[x:" +
            round2Digits(this.x) +
            "| y:" +
            round2Digits(this.y) +
            "| w:" +
            round2Digits(this.w) +
            "| h:" +
            round2Digits(this.h) +
            "]"
        );
    }

    /**
     * Returns a new rectangle in tile space which includes all tiles which are visible in this rect
     * @returns {Rectangle}
     */
    toTileCullRectangle() {
        return new Rectangle(
            Math.floor(this.x / globalConfig.tileSize),
            Math.floor(this.y / globalConfig.tileSize),
            Math.ceil(this.w / globalConfig.tileSize),
            Math.ceil(this.h / globalConfig.tileSize)
        );
    }
}

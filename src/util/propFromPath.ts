
export function propFromPath(obj: { [key: string]: any; }, path: string[]): unknown {
    const pathcopy = [...path];
    const nextKey: string = pathcopy.shift() || 'invalid';
    if (pathcopy.length < 1 || !Object.prototype.hasOwnProperty.call(obj, nextKey) || typeof obj !== 'object') {
        return obj[nextKey];
    }
    else if (pathcopy.length > 0) {
        return propFromPath(obj[nextKey], pathcopy);
    }
    else {
        return obj;
    }
}

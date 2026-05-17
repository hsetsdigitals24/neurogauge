declare module "jstat" {
  interface Distribution {
    pdf?: (x: number, ...params: number[]) => number;
    cdf: (x: number, ...params: number[]) => number;
    inv: (p: number, ...params: number[]) => number;
  }
  interface JStatStatic {
    normal: Distribution;
    studentt: Distribution;
    chisquare: Distribution;
    centralF: Distribution;
    tukey: Distribution;
    erf(x: number): number;
    erfc(x: number): number;
    gammaln(x: number): number;
    betafn(a: number, b: number): number;
  }
  export const jStat: JStatStatic;
}

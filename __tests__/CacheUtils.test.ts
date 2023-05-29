import { describe, test } from "vitest";
import { CacheUtils } from "../CacheUtils";
import { BaseQueryFn, createApi } from "@reduxjs/toolkit/query";

export const {
  invalidateOnSuccess,
  invalidateList,
  withNestedList,
  withNestedResultId,
  withTags,
  withArgAsId,
  withList,
  withNestedArgId,
  withDeepNestedList,
} = new CacheUtils<"TAG_1" | "TAG_2" | "TAG_3" | "TAG_4">();

describe("withNestedArgId", () => {
  test("should add tag with id arg extracted by 'extractId' callback", ({
    expect,
  }) => {
    const data = [{}, undefined, { id: "123" }] as const;
    type Arg = (typeof data)[2];

    const result = withNestedArgId("TAG_1", (arg: Arg) => arg.id)()(...data);

    expect(result).toEqual([{ type: "TAG_1", id: "123" }]);
  });

  test("should add tag if specified", ({ expect }) => {
    const data = [{}, undefined, { id: "123" }] as const;
    type Arg = (typeof data)[2];

    const result = withNestedArgId("TAG_1", (arg: Arg) => arg.id)(["TAG_2"])(
      ...data
    );

    expect(result).toEqual([{ type: "TAG_1", id: "123" }, "TAG_2"]);
  });
});

describe("withArgAsId", () => {
  test("should add tag from arg['id'] with specified type", ({ expect }) => {
    const data = [{}, undefined, "1"] as const;

    const result = withArgAsId("TAG_1")()(...data);

    expect(result).toEqual([{ type: "TAG_1", id: "1" }]);
  });

  test("should add tag if specified", ({ expect }) => {
    const data = [{}, undefined, "1"] as const;

    const result = withArgAsId("TAG_1")(["TAG_2"])(...data);

    expect(result).toEqual([{ type: "TAG_1", id: "1" }, "TAG_2"]);
  });
});

describe("withList", () => {
  test("should return tags with specified type, and ids from result", ({
    expect,
  }) => {
    const resultObject = [{ id: "1" }];

    const data = [resultObject, undefined, undefined] as const;

    const result = withList("TAG_1")()(...data);

    expect(result).toEqual([
      { type: "TAG_1", id: "LIST" },
      { type: "TAG_1", id: "1" },
    ]);
  });

  test("should have tag with specified type and id - LIST, when result rejected", ({
    expect,
  }) => {
    const data = [
      undefined,
      { status: "CUSTOM_ERROR", error: "" },
      undefined,
    ] as const;

    const result = withList("TAG_1")([])(...data);

    expect(result).toEqual([{ type: "TAG_1", id: "LIST" }]);
  });

  test("should add tag if specified", ({ expect }) => {
    const resultObject = [{ id: "1" }];
    const data = [resultObject, undefined, undefined] as const;

    const result = withList("TAG_1")(["TAG_2"])(...data);

    expect(result).toEqual([
      { type: "TAG_1", id: "LIST" },
      { type: "TAG_1", id: "1" },
      "TAG_2",
    ]);
  });
});

describe("withNestedList", () => {
  test("should return tags with specified type, and ids from result extracted by 'extractResult' callback", ({
    expect,
  }) => {
    const resultObject = { nested: { field: [{ id: "1" }] } };
    const data = [resultObject, undefined, undefined] as const;

    const result = withNestedList(
      "TAG_1",
      (result: typeof resultObject) => result.nested.field
    )()(...data);

    expect(result).toEqual([
      { type: "TAG_1", id: "LIST" },
      { type: "TAG_1", id: "1" },
    ]);
  });

  test("should have tag with specified type and id - LIST, when result rejected", ({
    expect,
  }) => {
    const resultObject = { nested: { field: [{ id: "1" }] } };
    const data = [
      undefined,
      { status: "CUSTOM_ERROR", error: "" },
      undefined,
    ] as const;

    const result = withNestedList(
      "TAG_1",
      (result: typeof resultObject) => result.nested.field
    )([])(...data);

    expect(result).toEqual([{ type: "TAG_1", id: "LIST" }]);
  });

  test("should add tag if specified", ({ expect }) => {
    const resultObject = { nested: { field: [{ id: "1" }] } };

    const data = [resultObject, undefined, undefined] as const;

    const result = withNestedList(
      "TAG_1",
      (result: typeof resultObject) => result.nested.field
    )(["TAG_2"])(...data);

    expect(result).toEqual([
      { type: "TAG_1", id: "LIST" },
      { type: "TAG_1", id: "1" },
      "TAG_2",
    ]);
  });
});

describe("invalidatesList", () => {
  test("should add tag with specified type and id - LIST", ({ expect }) => {
    const data = [{}, undefined, undefined] as const;

    const result = invalidateList("TAG_1")()(...data);

    expect(result).toEqual([{ type: "TAG_1", id: "LIST" }]);
  });
});

describe("invalidateOnSuccess", () => {
  test("should add specified tags if result success", ({ expect }) => {
    const data = [{}, undefined, undefined] as const;

    const result = invalidateOnSuccess(["TAG_1"])(...data);

    expect(result).toEqual(["TAG_1"]);
  });

  test("should not add specified tags if result rejected", ({ expect }) => {
    const data = [
      undefined,
      { status: "CUSTOM_ERROR", error: "" },
      undefined,
    ] as const;

    const result = invalidateOnSuccess(["TAG_1"])(...data);

    expect(result).toEqual([]);
  });
});

describe("pipeTagsGetters", () => {
  test("correctly provide tags from tags getters", ({ expect }) => {
    const resultObject = { nested: { field: [{ id: "1" }] } };
    const data = [resultObject, undefined, undefined] as const;

    const result = withTags<typeof resultObject, void>([
      invalidateList("TAG_1"),
      withNestedList(
        "TAG_3",
        (result: typeof resultObject) => result.nested.field
      ),
    ])()(...data);

    expect(result).toEqual([
      { type: "TAG_1", id: "LIST" },
      { type: "TAG_3", id: "LIST" },
      { type: "TAG_3", id: "1" },
    ]);
  });
});

test("order of adding tags should the same as we read", ({ expect }) => {
  const data = [undefined, undefined, undefined] as const;

  const addListTagOne = invalidateList("TAG_1");
  const addListTagTwo = invalidateList("TAG_2");

  const result = withTags([addListTagOne, addListTagTwo])(["TAG_4"])(...data);

  expect(result).toEqual([
    { type: "TAG_1", id: "LIST" },
    { type: "TAG_2", id: "LIST" },
    "TAG_4",
  ]);
});

test("types should work correctly with createApi and customBaseQuery from RTK Query", () => {
  type ResultType = { products: { name: string; id: number }[] };
  type ArgType = number;
  type MyBaseQueryErrorType = { error: string };

  const tagTypes = ["TAG_1", "TAG_2", "TAG_3", "TAG_4"] as const;
  type TagTypes = (typeof tagTypes)[number];

  const { invalidateList, withTags, withNestedList } = new CacheUtils<
    TagTypes,
    MyBaseQueryErrorType
  >();

  const myBaseQuery =
    (): BaseQueryFn<{ url: string }, unknown, MyBaseQueryErrorType> =>
    async ({ url }) => {
      try {
        const result = await fetch(url);
        return await result.json();
      } catch (queryError) {
        return queryError as MyBaseQueryErrorType;
      }
    };

  createApi({
    baseQuery: myBaseQuery(),
    tagTypes,
    endpoints: (build) => ({
      getProducts: build.query<ResultType, ArgType>({
        query: (arg) => ({ url: `products/${arg}` }),
        providesTags: invalidateList<ResultType, ArgType>("TAG_3")(
          (result, error, arg) => []
        ),
      }),
      getProducts1: build.query<ResultType, ArgType>({
        query: (arg) => ({ url: `products/${arg}` }),
        providesTags: withTags<ResultType, ArgType>([
          invalidateList("TAG_3"),
          withNestedList("TAG_2", (result) => result.products),
        ])((result, error, arg) => []),
      }),
    }),
  });
});

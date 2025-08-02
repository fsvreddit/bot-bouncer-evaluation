import { yamlToVariables } from "../src/utility";

test("Substitutions Module - strings", () => {
    const yaml = `
name: substitutions
sub1: value1
sub2: value2
---
name: module1
var1: "{{sub1}}"
var2: "{{sub2}}"
---
name: module2
head1:
    subhead2:
        subhead3: "{{sub1}}"
`;

    const variables = yamlToVariables(yaml) as Record<string, unknown>;
    expect(variables["module1:var1"]).toBe("value1");
    expect(variables["module1:var2"]).toBe("value2");

    const head1 = variables["module2:head1"];
    if (!head1) {
        assert.fail("Expected head1 to be defined");
    }
    // Add type assertion to inform TypeScript about the expected structure
    const typedHead1 = head1 as { subhead2: { subhead3: string } };
    expect(typedHead1.subhead2.subhead3).toBe("value1");
});

test("Substitutions Module - arrays", () => {
    const yaml = `
name: substitutions
arraysub:
    - value1
    - value2
    - 'value''3'
    - "value\\4"
---
name: module1
var1: {{arraysub}}
`;

    const variables = yamlToVariables(yaml) as Record<string, unknown>;
    expect(variables["module1:var1"]).toEqual(["value1", "value2", "value'3", "value\\4"]);
});

test("Duplicate keys", () => {
    const yaml = `
name: botgroupadvanced

group1:
    name: group1

group1:
    name: group2
`;

    const errors = yamlToVariables(yaml).errors as string[] | undefined;
    expect(errors).toBeDefined();
    expect(errors).toContain("Module name botgroupadvanced has duplicate keys");
});

test("Duplicate keys 2", () => {
    const yaml = `
name: botgroupadvanced

group1:
    name: group1
    usernameRegex:
        - "test"
    usernameRegex:
        - "test2"

`;

    const errors = yamlToVariables(yaml).errors as string[] | undefined;
    expect(errors).toBeDefined();
    expect(errors).toContain("Module name botgroupadvanced has duplicate keys");
});

test("Duplicate modules", () => {
    const yaml = `
name: botgroupadvanced

group1:
    name: group1
    usernameRegex:
        - "test"
---
name: botgroupadvanced
group1:
    name: group1
    usernameRegex:
        - "test2"
`;

    const errors = yamlToVariables(yaml).errors as string[] | undefined;
    expect(errors).toBeDefined();
    expect(errors).toEqual(["Module name botgroupadvanced is present more than once"]);
});

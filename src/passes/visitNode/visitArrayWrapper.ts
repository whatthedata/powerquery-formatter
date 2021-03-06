// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as PQP from "@microsoft/powerquery-parser";
import { expectGetIsMultiline } from "../isMultiline/common";
import { IndentationChange, SerializeParameterState, SerializeWriteKind } from "../types";
import { isSectionMemeberSimilarScope, propagateWriteKind, setWorkspace } from "./visitNodeUtils";

export function visitArrayWrapper(state: SerializeParameterState, node: PQP.Language.Ast.TArrayWrapper): void {
    const parent: PQP.Language.Ast.TNode = PQP.Parser.NodeIdMapUtils.assertGetParentAst(
        state.nodeIdMapCollection,
        node.id,
    );

    switch (parent.kind) {
        case PQP.Language.Ast.NodeKind.Section:
            visitArrayWrapperForSectionMembers(state, parent.sectionMembers);
            break;

        case PQP.Language.Ast.NodeKind.UnaryExpression:
            visitArrayWrapperForUnaryExpression(state, parent.operators);
            break;

        default:
            visitArrayWrapperDefault(state, node);
    }
}

function visitArrayWrapperDefault(state: SerializeParameterState, node: PQP.Language.Ast.TArrayWrapper): void {
    const isMultiline: boolean = expectGetIsMultiline(state.isMultilineMap, node);

    let maybeWriteKind: SerializeWriteKind | undefined;
    let maybeIndentationChange: IndentationChange | undefined;
    if (isMultiline) {
        maybeWriteKind = SerializeWriteKind.Indented;
        maybeIndentationChange = 1;
    } else {
        maybeWriteKind = SerializeWriteKind.Any;
    }

    for (const element of node.elements) {
        setWorkspace(state, element, {
            maybeWriteKind,
            maybeIndentationChange,
        });
    }
}

function visitArrayWrapperForSectionMembers(
    state: SerializeParameterState,
    node: PQP.Language.Ast.IArrayWrapper<PQP.Language.Ast.SectionMember>,
): void {
    let maybePreviousSectionMember: PQP.Language.Ast.SectionMember | undefined;
    for (const member of node.elements) {
        if (member.kind !== PQP.Language.Ast.NodeKind.SectionMember) {
            const details: {} = { nodeKind: member.kind };
            throw new PQP.CommonError.InvariantError(`expected sectionMember`, details);
        }

        let memberWriteKind: SerializeWriteKind = SerializeWriteKind.DoubleNewline;

        if (maybePreviousSectionMember && isSectionMemeberSimilarScope(member, maybePreviousSectionMember)) {
            memberWriteKind = SerializeWriteKind.Indented;
        }

        setWorkspace(state, member, { maybeWriteKind: memberWriteKind });

        maybePreviousSectionMember = member;
    }
}

function visitArrayWrapperForUnaryExpression(
    state: SerializeParameterState,
    node: PQP.Language.Ast.IArrayWrapper<PQP.Language.Ast.IConstant<PQP.Language.Constant.UnaryOperatorKind>>,
): void {
    // `not` is an unary operator which needs to be padded.
    // The default Any write kind is fine for the other operators (`+` and `-`).
    const elements: ReadonlyArray<PQP.Language.Ast.IConstant<PQP.Language.Constant.UnaryOperatorKind>> = node.elements;
    const numElements: number = node.elements.length;

    propagateWriteKind(state, node, elements[0]);
    let previousWasNotOperator: boolean = elements[0].constantKind === PQP.Language.Constant.UnaryOperatorKind.Not;
    for (let index: number = 1; index < numElements; index += 1) {
        const operatorConstant: PQP.Language.Ast.IConstant<PQP.Language.Constant.UnaryOperatorKind> = elements[index];

        if (previousWasNotOperator || operatorConstant.constantKind === PQP.Language.Constant.UnaryOperatorKind.Not) {
            setWorkspace(state, operatorConstant, { maybeWriteKind: SerializeWriteKind.PaddedLeft });
        }
        previousWasNotOperator = operatorConstant.constantKind === PQP.Language.Constant.UnaryOperatorKind.Not;
    }
}

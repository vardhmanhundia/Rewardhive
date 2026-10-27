"""LangGraph state graph for card agent"""
from langgraph.graph import StateGraph


def create_graph():
    """Create the main agent graph"""
    workflow = StateGraph(dict)

    # TODO: Add nodes and edges for card management workflow

    return workflow.compile()

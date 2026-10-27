"""Card management service"""


class CardService:
    """Service for managing cards"""

    async def get_all_cards(self):
        """Get all cards"""
        return []

    async def create_card(self, card_data):
        """Create a new card"""
        return card_data

    async def delete_card(self, card_id):
        """Delete a card"""
        return {"id": card_id, "deleted": True}

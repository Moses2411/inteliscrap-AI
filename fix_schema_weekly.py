p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\schemas.py'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

c = c.replace(
    '''class SubscriptionStatusResponse(BaseModel):
    plan: str
    status: str
    expires_at: Optional[datetime] = None
    listings_today: int
    daily_limit: int
    max_weight_kg: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)''',
    '''class SubscriptionStatusResponse(BaseModel):
    plan: str
    status: str
    expires_at: Optional[datetime] = None
    listings_this_week: int
    weekly_limit: int
    max_weight_kg: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)'''
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')
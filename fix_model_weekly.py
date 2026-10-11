p = r'C:\Users\Moses\Desktop\MCF\IntelliScrap\backend\app\models.py'
with open(p, 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

# Replace daily tracking columns with weekly tracking
c = c.replace(
    '''    # Subscription fields
    subscription_plan = Column(_db_enum(SubscriptionPlan), nullable=False, default=SubscriptionPlan.freemium, index=True)
    subscription_status = Column(_db_enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.active, index=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    listings_today = Column(Integer, nullable=False, default=0)
    listings_today_date = Column(Date, nullable=True)''',
    '''    # Subscription fields
    subscription_plan = Column(_db_enum(SubscriptionPlan), nullable=False, default=SubscriptionPlan.freemium, index=True)
    subscription_status = Column(_db_enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.active, index=True)
    subscription_expires_at = Column(DateTime, nullable=True)
    listings_this_week = Column(Integer, nullable=False, default=0)
    listings_week_start = Column(Date, nullable=True)'''
)

with open(p, 'w', encoding='utf-8') as f:
    f.write(c)
print('ok')
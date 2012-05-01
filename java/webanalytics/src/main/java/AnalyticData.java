public class AnalyticData {
	protected String host, visitor;
	protected long arrival;
	
	public AnalyticData() {}

  public String getHost() {
    return host;
  }

  public void setHost(String host) {
    this.host = host;
  }

  public String getVisitor() {
    return visitor;
  }

  public void setVisitor(String visitor) {
    this.visitor = visitor;
  }

  public long getArrival() {
    return arrival;
  }

  public void setArrival(long arrival) {
    this.arrival = arrival;
  }
  
  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    
    sb.append("Host: ");
    if (null == this.host) {
      sb.append("null");
    } else {
      sb.append(this.host);
    }
    
    sb.append(", Visitor: ");
    if (null == this.visitor) {
      sb.append("null");
    } else {
      sb.append(this.visitor);
    }
    
    sb.append(", Arrival: ").append(this.arrival);
    
    return sb.toString();
  }
  
}
